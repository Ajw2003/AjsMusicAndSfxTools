// Browser check for arranger phase A steps A2/A3/A6 (#72, #73, #76).
//
// Not part of `npm test`: Playwright is not a project dependency yet. Run it
// against a running dev server with a Playwright install on NODE_PATH:
//   npx vite --port 5173 --strictPort      (in one terminal)
//   node e2e/timeline.cjs                  (in another)
// It prints one PASS/FAIL line per check and exits non-zero on any failure.

const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const URL = process.env.APP_URL ?? "http://localhost:5173/";
let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
}

// Records every scheduled sound start as context time, so playback can be
// checked against the mechanism rather than by ear.
function hookAudioStarts() {
  // Synth notes start an OscillatorNode at a scheduled time; Tone's own
  // housekeeping nodes start "now" without one, so they are left out.
  window.__starts = [];
  const original = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when, ...rest) {
    const isLive = !(this.context instanceof OfflineAudioContext);
    if (isLive && typeof when === "number" && when > 0) {
      window.__starts.push(when);
    }
    return original.call(this, when, ...rest);
  };
}

function note(id, pitch, startBeat, durationBeats = 0.5) {
  return { id, pitch, startBeat, durationBeats, velocity: 0.8 };
}

function clip(id, startBeat, lengthBeats, loopBeats, notes) {
  return {
    id,
    name: id,
    startBeat,
    lengthBeats,
    loopBeats,
    offsetBeats: 0,
    transpose: 0,
    gainDb: 0,
    colour: null,
    content: { kind: "notes", notes },
  };
}

function songFile(bpm, clips, loopRegion = null) {
  return JSON.stringify({
    version: 2,
    bpm,
    beatsPerBar: 4,
    tracks: [
      {
        id: "t1",
        name: "Lead",
        kind: "notes",
        sound: "square",
        volumeDb: 0,
        isMuted: false,
        clips,
      },
    ],
    loopRegion,
    chordPads: [],
  });
}

async function start(browser, viewport) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => check("no page errors", false, e.message));
  await page.addInitScript(hookAudioStarts);
  await page.goto(URL);
  await page.getByRole("button", { name: /press any key to start/i }).click();
  await page.waitForTimeout(300);
  return { context, page };
}

async function openSong(page, json, name) {
  const file = path.join(os.tmpdir(), name);
  fs.writeFileSync(file, json);
  await page.getByLabel("Open project file").setInputFiles(file);
  await page.getByText(`Opened ${name}.`).waitFor();
}

const position = (page) => page.getByLabel("Position").textContent();
const bpmInput = (page) => page.getByLabel("BPM");

async function setBpm(page, bpm) {
  await bpmInput(page).fill(String(bpm));
  await bpmInput(page).press("Enter");
  await page.locator("body").click({ position: { x: 2, y: 2 } });
}

async function recordIntoClip(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  await setBpm(page, 240); // 16 beats = 4 s
  const clips = page.locator("[data-clip-id]");
  check("new song shows one clip", (await clips.count()) === 1);

  await clips.first().click();
  check(
    "clicked clip is selected",
    (await clips.first().getAttribute("aria-selected")) === "true",
  );
  await page.getByRole("button", { name: "Record" }).click();
  await page.waitForTimeout(1000 + 400); // count-in, then into the loop
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(200);
  await page.keyboard.up("KeyA");
  await page.waitForTimeout(4200); // past the wrap: the pass is committed
  check(
    "a recorded pass lands in the clip",
    (await page.getByTestId("note-summary").first().textContent()) === "1 note",
  );
  await page.getByRole("button", { name: "Record" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  const paused = await position(page);
  await page.waitForTimeout(400);
  check("pause keeps the playhead", (await position(page)) === paused, paused);

  // Ruler click: bar 9 is beat 32.
  const ruler = page.getByRole("slider", { name: "Playhead" });
  const px = 32 * 24; // default zoom is 24 px per beat
  await page
    .locator(".scroller")
    .evaluate((el, x) => (el.scrollLeft = x - 100), px);
  // Click positions are relative to the ruler's own left edge.
  await ruler.click({ position: { x: px, y: 5 } });
  check(
    "ruler click moves the playhead",
    (await position(page)) === "Bar 9 · Beat 1",
    await position(page),
  );
  await ruler.focus();
  await page.keyboard.press("PageUp");
  check(
    "ruler keys move the playhead",
    (await position(page)) === "Bar 10 · Beat 1",
    await position(page),
  );

  await page.getByRole("button", { name: "New clip" }).click();
  check("New clip adds a clip", (await clips.count()) === 2);
  const label = await clips.nth(1).getAttribute("aria-label");
  check("New clip sits at the playhead bar", /bar 10,/.test(label), label);
  await page.getByRole("button", { name: "Undo" }).click();
  check("undo removes the new clip", (await clips.count()) === 1);
  await page.getByRole("button", { name: "Back to start" }).click();
  check(
    "Back to start",
    (await position(page)) === "Bar 1 · Beat 1",
    await position(page),
  );
  await context.close();
}

async function stretchedClipRepeats(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  // A 4-beat loop holding one note, stretched to 16 beats: 4 soundings.
  await openSong(
    page,
    songFile(240, [clip("c1", 4, 16, 4, [note("n1", 60, 0)])]),
    "stretch.ajsong.json",
  );
  await page.evaluate(() => (window.__starts = []));
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(6000); // song end is 20 beats = 5 s
  check(
    "linear playback stops by itself at the song end",
    (await page.getByRole("button", { name: "Play" }).count()) === 1,
  );
  const starts = await page.evaluate(() => window.__starts);
  const unique = [...new Set(starts.map((s) => s.toFixed(3)))].map(Number);
  const gaps = unique.slice(1).map((s, i) => s - unique[i]);
  check(
    "a stretched clip repeats its loop in playback",
    unique.length === 4 && gaps.every((g) => Math.abs(g - 1) < 0.02),
    `${unique.length} starts, gaps ${gaps.map((g) => g.toFixed(3)).join(", ")}`,
  );
  await context.close();
}

async function loopRegion(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  await openSong(
    page,
    songFile(240, [clip("c1", 0, 32, 4, [note("n1", 60, 0)])], {
      startBeat: 4,
      endBeat: 8,
    }),
    "loop.ajsong.json",
  );
  await page.getByRole("button", { name: "Loop" }).click();
  await page.getByRole("button", { name: "Play" }).click();
  const seen = new Set();
  for (let i = 0; i < 25; i++) {
    seen.add(await position(page));
    await page.waitForTimeout(100);
  }
  await page.getByRole("button", { name: "Pause" }).click();
  check(
    "loop region repeats bar 2 only",
    [...seen].every((p) => p.startsWith("Bar 2")) && seen.size >= 3,
    [...seen].join(" | "),
  );
  await context.close();
}

async function wavCoversSong(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  // 32 beats at 120 BPM = 16 s, plus the 1 s tail.
  await openSong(
    page,
    songFile(120, [clip("c1", 16, 16, 4, [note("n1", 60, 0)])], {
      startBeat: 0,
      endBeat: 4,
    }),
    "export.ajsong.json",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download WAV" }).click();
  const file = await (await download).path();
  const bytes = fs.readFileSync(file);
  const rate = bytes.readUInt32LE(24);
  const channels = bytes.readUInt16LE(22);
  const seconds = bytes.readUInt32LE(40) / (rate * channels * 2);
  check(
    "whole-song WAV covers the full song",
    Math.abs(seconds - 17) < 0.05,
    `${seconds.toFixed(2)} s`,
  );
  await context.close();
}

async function phone64Bars(browser) {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    const { context, page } = await start(browser, viewport);
    await openSong(
      page,
      songFile(120, [clip("c1", 0, 256, 16, [note("n1", 60, 0)])]),
      "long.ajsong.json",
    );
    const where = `${viewport.width}px`;
    const pageScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(`${where}: no page-level sideways scroll`, pageScroll <= 0);
    const scroller = page.locator(".scroller");
    const inner = await scroller.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }));
    check(
      `${where}: timeline scrolls inside its box`,
      inner.scroll > inner.client,
      JSON.stringify(inner),
    );
    const bar64 = await scroller.evaluate((el) => {
      // Bar 64 starts at beat 252; 24 px per beat is the default zoom.
      el.scrollLeft = 252 * 24 - 20;
      const corner = el.querySelector(".corner").getBoundingClientRect();
      const box = {
        left: corner.right,
        right: el.getBoundingClientRect().right,
      };
      const label = [...el.querySelectorAll(".ruler .label")].find(
        (x) => x.textContent === "64",
      );
      if (!label) return null;
      const r = label.getBoundingClientRect();
      return { left: r.left, right: r.right, box: [box.left, box.right] };
    });
    check(
      `${where}: bar 64 is reachable`,
      bar64 !== null &&
        bar64.left >= bar64.box[0] &&
        bar64.right <= bar64.box[1],
      JSON.stringify(bar64),
    );
    const before = inner.scroll;
    await page.getByRole("button", { name: "Zoom out" }).click();
    const after = await scroller.evaluate((el) => el.scrollWidth);
    check(`${where}: zoom out shrinks the timeline`, after < before);
    await page.screenshot({
      path: path.join(os.tmpdir(), `timeline-${viewport.width}.png`),
    });
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  try {
    await recordIntoClip(browser);
    await stretchedClipRepeats(browser);
    await loopRegion(browser);
    await wavCoversSong(browser);
    await phone64Bars(browser);
  } finally {
    await browser.close();
  }
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
