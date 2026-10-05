// Browser checks: arranger phases A (#72–#76) and B (#77, #78), and the
// usability pass (#84).
//
// Run with `npm run test:e2e`: it builds the app, serves the build on a free
// port and drives it in Chromium (install it once: `npx playwright install
// chromium`). APP_URL=<url> tests an already-running app instead, and
// CHROMIUM_PATH=<file> uses a Chromium already on the machine.
// It prints one PASS/FAIL line per check and exits non-zero on any failure.

const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/** Set in main(): APP_URL, or the address of the preview server it starts. */
let URL = process.env.APP_URL ?? "";
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

function track(id, name, clips) {
  return {
    id,
    name,
    kind: "notes",
    sound: "square",
    volumeDb: 0,
    isMuted: false,
    clips,
  };
}

function songFile(bpm, clips, loopRegion = null, extraTracks = []) {
  return JSON.stringify({
    version: 2,
    bpm,
    beatsPerBar: 4,
    tracks: [track("t1", "Lead", clips), ...extraTracks],
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

/** Open a panel by its tab (Track, Clip, Chord builder, …) unless it is open. */
async function openPanel(page, label) {
  const tab = page
    .getByRole("navigation", { name: "Panels" })
    .getByRole("button", { name: label, exact: true });
  if ((await tab.getAttribute("aria-expanded")) !== "true") await tab.click();
}

async function openSong(page, json, name) {
  await openPanel(page, "Save & export");
  const file = path.join(os.tmpdir(), name);
  fs.writeFileSync(file, json);
  await page.getByLabel("Open project file").setInputFiles(file);
  await page.getByText(`Opened ${name}.`).waitFor();
}

const position = (page) => page.getByLabel("Position").textContent();
const bpmInput = (page) => page.getByLabel("Tempo (beats per minute)");

async function setBpm(page, bpm) {
  await openPanel(page, "Song");
  await bpmInput(page).fill(String(bpm));
  await bpmInput(page).press("Enter");
  await page.locator("body").click({ position: { x: 2, y: 2 } });
}

// Owner report 2026-10-04: recording stopped at a count of 16 and looped
// back over the take. Recording now runs on until Record is pressed again.
async function longTake(browser) {
  const { context, page } = await start(browser, { width: 1280, height: 800 });
  // Noise drums start AudioBufferSourceNodes, so the backing hats can be
  // told apart from the live notes (oscillators) played over them.
  await page.evaluate(() => {
    window.__hats = [];
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, ...rest) {
      if (!(this.context instanceof OfflineAudioContext) && when > 0) {
        window.__hats.push(when);
      }
      return original.call(this, when, ...rest);
    };
  });
  const hats = [];
  for (let b = 0; b < 64; b++) hats.push(note(`h${b}`, 80, b, 0.25));
  const hatTrack = {
    ...track("t2", "Hats", [clip("H", 0, 64, 64, hats)]),
    sound: "noise",
  };
  await openSong(
    page,
    songFile(240, [clip("A", 0, 16, 16, [])], null, [hatTrack]),
    "long.ajsong.json",
  );
  await page.locator('[data-clip-id="A"]').click();
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(1000 + 300); // count-in
  const positions = [];
  // One note per bar for 8 bars (1 s = one bar at 240 BPM).
  for (let bar = 0; bar < 8; bar++) {
    await page.keyboard.down("KeyA");
    await page.waitForTimeout(150);
    await page.keyboard.up("KeyA");
    positions.push(await position(page));
    await page.waitForTimeout(850);
  }
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await pauseIfPlaying(page);

  const bars = positions.map((p) => Number(/Bar (\d+)/.exec(p)[1]));
  check(
    "a long take never jumps back to the start",
    bars.every((b, i) => i === 0 || b > bars[i - 1]) && bars.at(-1) >= 8,
    bars.join(", "),
  );
  const saved = await savedSong(page);
  const a = saved.tracks[0].clips.find((c) => c.id === "A");
  check(
    "the clip grew past 16 beats to hold the take",
    a.lengthBeats >= 32 && a.loopBeats === a.lengthBeats,
    `length ${a.lengthBeats}, notes area ${a.loopBeats}`,
  );
  const starts = a.content.notes.map((n) => n.startBeat).sort((x, y) => x - y);
  check(
    "all 8 notes are kept, one per bar",
    starts.length === 8 &&
      starts.every((b, i) => i === 0 || b - starts[i - 1] > 2),
    starts.map((b) => b.toFixed(2)).join(", "),
  );
  const times = await page.evaluate(() => window.__hats);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const odd = gaps.filter((g) => Math.abs(g - 0.25) > 0.01);
  check(
    "the backing track plays every beat once while the take is stored",
    times.length >= 30 && odd.length === 0,
    `${times.length} hats, odd gaps: ${odd.map((g) => g.toFixed(3)).join(" ") || "none"}`,
  );
  await page.getByRole("button", { name: "Undo" }).click();
  const undone = (await savedSong(page)).tracks[0].clips.find(
    (c) => c.id === "A",
  );
  check(
    "one Undo removes the whole take",
    undone.content.notes.length === 0 && undone.lengthBeats === 16,
    `${undone.content.notes.length} notes, length ${undone.lengthBeats}`,
  );
  await context.close();
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
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(1000 + 400); // count-in, then into the loop
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(200);
  await page.keyboard.up("KeyA");
  await page.waitForTimeout(4200); // past the clip's 4-bar end
  check(
    "a recorded note lands in the clip",
    (await page.getByTestId("note-summary").first().textContent()) === "1 note",
  );
  // Recording runs on in a straight line: no jump back to bar 1.
  const runningAt = await position(page);
  check(
    "recording carries on past the clip end instead of looping",
    /^Bar ([5-9]|\d\d)/.test(runningAt),
    runningAt,
  );
  await page.getByRole("button", { name: "Record", exact: true }).click();
  // Past the song end, stopping the recording also stops playback there.
  await page.getByRole("button", { name: "Play", exact: true }).waitFor();
  const paused = await position(page);
  await page.waitForTimeout(400);
  check(
    "stopping keeps the playhead",
    (await position(page)) === paused,
    paused,
  );

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

  await openPanel(page, "Recording");
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
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(6000); // song end is 20 beats = 5 s
  check(
    "linear playback stops by itself at the song end",
    (await page.getByRole("button", { name: "Play", exact: true }).count()) ===
      1,
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
  await openPanel(page, "Timeline");
  await page.getByRole("button", { name: "Loop" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  // Playback starts 100 ms after Play (the look-ahead), and until then the
  // position still shows the old playhead, so start sampling once it moves.
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Position"]')
        ?.textContent?.startsWith("Bar 2"),
    null,
    { timeout: 2000 },
  );
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
  await openPanel(page, "Save & export");
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

// Where a clip sits, read from its drawn geometry (24 px per beat).
async function geometry(page, id) {
  return page.locator(`[data-clip-id="${id}"]`).evaluate((el) => ({
    start: parseFloat(el.style.left) / 24,
    length: (parseFloat(el.style.width) + 2) / 24,
    lane: el.closest("[data-track-id]").dataset.trackId,
  }));
}

async function dragBy(page, id, part, dxBeats, dyPx = 0) {
  const box = await page.locator(`[data-clip-id="${id}"]`).boundingBox();
  const x =
    part === "trim"
      ? box.x + 3
      : part === "stretch"
        ? box.x + box.width - 3
        : box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Several steps, like a real hand, so the drag threshold is crossed.
  await page.mouse.move(x + (dxBeats * 24) / 2, y + dyPx / 2, { steps: 5 });
  await page.mouse.move(x + dxBeats * 24, y + dyPx, { steps: 5 });
  await page.mouse.up();
}

async function dragClips(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  await openSong(
    page,
    songFile(120, [clip("A", 4, 4, 4, [note("n1", 60, 0)])], null, [
      track("t2", "Bass", []),
    ]),
    "drag.ajsong.json",
  );
  const undo = () => page.getByRole("button", { name: "Undo" }).click();
  const at = (g) => `start ${g.start}, length ${g.length}, ${g.lane}`;
  const before = await geometry(page, "A");

  await dragBy(page, "A", "move", 2.6);
  let g = await geometry(page, "A");
  check("drag moves and snaps to the beat", g.start === 7, at(g));
  await undo();
  g = await geometry(page, "A");
  check("one undo reverts a move", g.start === before.start, at(g));

  await dragBy(page, "A", "stretch", 4.3);
  g = await geometry(page, "A");
  check("right edge stretches to the beat", g.length === 8, at(g));
  const preview = await page
    .locator('[data-clip-id="A"] .note')
    .evaluateAll((els) => els.length);
  check("a stretched clip shows its content repeated", preview === 2);
  await undo();
  g = await geometry(page, "A");
  check("one undo reverts a stretch", g.length === 4, at(g));

  await dragBy(page, "A", "trim", 1.2);
  g = await geometry(page, "A");
  check("left edge trims to the beat", g.start === 5 && g.length === 3, at(g));
  await undo();

  await openPanel(page, "Timeline");
  await page.getByLabel("Line clips up to:").selectOption({ label: "Bars" });
  await dragBy(page, "A", "move", 2.6);
  g = await geometry(page, "A");
  check("bar snap lands on a bar", g.start === 8, at(g));
  await undo();
  await page.getByLabel("Line clips up to:").selectOption({ label: "Nothing" });
  await dragBy(page, "A", "move", 1.5);
  g = await geometry(page, "A");
  check("snap off moves freely", Math.abs(g.start - 5.5) < 0.05, at(g));
  await undo();
  await page.getByLabel("Line clips up to:").selectOption({ label: "Beats" });

  const laneHeight = await page
    .locator('[data-track-id="t2"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  await dragBy(page, "A", "move", 0, laneHeight);
  g = await geometry(page, "A");
  check("drag moves a clip to another track", g.lane === "t2", at(g));
  await undo();
  g = await geometry(page, "A");
  check("one undo returns it to its track", g.lane === "t1", at(g));

  await page.locator('[data-clip-id="A"]').click();
  check(
    "a click without moving still selects",
    (await page.locator('[data-clip-id="A"]').getAttribute("aria-selected")) ===
      "true",
  );

  // Keyboard equivalents.
  await page.locator('[data-clip-id="A"]').focus();
  await page.keyboard.press("ArrowRight");
  g = await geometry(page, "A");
  check("Right arrow moves one snap step", g.start === 5, at(g));
  await page.keyboard.press("Shift+ArrowRight");
  g = await geometry(page, "A");
  check("Shift+Right lengthens", g.length === 5, at(g));
  await page.keyboard.press("Alt+ArrowRight");
  g = await geometry(page, "A");
  check("Alt+Right trims the start", g.start === 6 && g.length === 4, at(g));
  await page.keyboard.press("ArrowDown");
  g = await geometry(page, "A");
  check("Down moves to the next track", g.lane === "t2", at(g));
  const focused = await page.evaluate(
    () => document.activeElement?.dataset.clipId,
  );
  check("focus stays on the moved clip", focused === "A");
  for (let i = 0; i < 4; i++) await undo();
  g = await geometry(page, "A");
  check(
    "four undos revert four key edits",
    g.start === 4 && g.length === 4 && g.lane === "t1",
    at(g),
  );
  await context.close();
}

async function chordBuilderClip(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  await openSong(page, songFile(240, []), "chords.ajsong.json");
  await openPanel(page, "Chord builder");
  const builder = page.getByRole("region", { name: "Chord builder" });
  await builder.getByLabel(/^Key/).selectOption({ label: "D" });
  await builder
    .getByLabel("Start from")
    .selectOption({ label: "I–V–vi–IV (pop)" });
  const names = await builder.locator(".progression .name").allTextContents();
  check(
    "I–V–vi–IV in D is D A Bm G",
    names.join(" ") === "D A Bm G",
    names.join(" "),
  );
  await builder.getByRole("button", { name: /Make clip at playhead/ }).click();
  const label = await page
    .locator("[data-clip-id]")
    .first()
    .getAttribute("aria-label");
  check(
    "the chord clip shows its chord names",
    / 4 bars, chords D A Bm G$/.test(label),
    label,
  );
  const saved = await savedSong(page);
  const content = saved.tracks[0].clips[0].content;
  const at = (beat) =>
    content.notes
      .filter((n) => n.startBeat === beat)
      .map((n) => n.pitch)
      .sort((a, b) => a - b)
      .join(",");
  check(
    "the clip holds the right notes (D A Bm G triads)",
    at(0) === "50,54,57" &&
      at(4) === "57,61,64" &&
      at(8) === "59,62,66" &&
      at(12) === "55,59,62",
    [0, 4, 8, 12].map(at).join(" | "),
  );
  await page.getByRole("button", { name: "Back to start" }).click();
  await page.evaluate(() => (window.__starts = []));
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(4600); // 16 beats at 240 BPM = 4 s
  const starts = await page.evaluate(() => window.__starts);
  // Notes of one chord start within a few ms of each other: group by gaps.
  const groups = [];
  for (const t of [...starts].sort((x, y) => x - y)) {
    if (groups.length === 0 || t - groups.at(-1) > 0.1) groups.push(t);
  }
  const gaps = groups.slice(1).map((t, i) => t - groups[i]);
  check(
    "playback sounds 4 chords of 3 notes, 1 s apart, and nothing after the end",
    starts.length === 12 &&
      groups.length === 4 &&
      gaps.every((g) => Math.abs(g - 1) < 0.02),
    `${starts.length} notes in ${groups.length} groups, gaps ${gaps.map((g) => g.toFixed(3)).join(", ")}`,
  );
  await page.getByRole("button", { name: "Undo" }).click();
  check(
    "making the clip is one undo step",
    (await page.locator("[data-clip-id]").count()) === 0,
  );
  await context.close();
}

async function chordPads(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  await openSong(
    page,
    songFile(240, [clip("A", 0, 16, 16, [])]),
    "pads.ajsong.json",
  );
  await openPanel(page, "Chord builder");
  const builder = page.getByRole("region", { name: "Chord builder" });
  await builder
    .getByLabel("Start from")
    .selectOption({ label: "I–V–vi–IV (pop)" });
  for (const name of ["C", "G", "Am", "F"]) {
    await builder
      .getByRole("button", { name: `Save ${name} as a chord pad` })
      .click();
  }
  const pads = page.getByRole("region", { name: "Chord pads" });
  const padNames = async () =>
    pads
      .getByRole("button", { name: /^Play / })
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  check(
    "saved chords become pads on keys 1–4",
    (await padNames()).join(" | ") ===
      "Play C, key 1 | Play G, key 2 | Play Am, key 3 | Play F, key 4",
    (await padNames()).join(" | "),
  );

  // Record the four pads by number key into clip A (16 beats = 4 s).
  await page.locator('[data-clip-id="A"]').click();
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(1000 + 200);
  for (const key of ["Digit1", "Digit2", "Digit3", "Digit4"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(300);
    await page.keyboard.up(key);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Record", exact: true }).click();
  // Stopping a take past the song end also stops playback; else pause.
  await pauseIfPlaying(page);
  const saved = await savedSong(page);
  const notes = saved.tracks[0].clips[0].content.notes;
  const chordsHeard = [];
  for (const n of [...notes].sort((a, b) => a.startBeat - b.startBeat)) {
    const last = chordsHeard.at(-1);
    if (last && Math.abs(n.startBeat - last.at) < 0.3)
      last.pitches.push(n.pitch);
    else chordsHeard.push({ at: n.startBeat, pitches: [n.pitch] });
  }
  const shapes = chordsHeard.map((c) =>
    c.pitches.sort((a, b) => a - b).join(","),
  );
  check(
    "pads played by number keys record as chords",
    shapes.join(" | ") === "48,52,55 | 55,59,62 | 57,60,64 | 53,57,60",
    shapes.join(" | "),
  );

  await page.reload();
  await page.getByRole("button", { name: /press any key to start/i }).click();
  check(
    "pads are still there after a reload",
    (await padNames()).length === 4,
    (await padNames()).join(" | "),
  );
  await pads.getByRole("button", { name: "Remove pad F" }).click();
  check("a pad can be removed", (await padNames()).length === 3);
  await context.close();
}

async function scrubbing(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  await openSong(
    page,
    songFile(120, [clip("A", 16, 8, 4, [])]),
    "scrub.ajsong.json",
  );
  const scrubAlong = async (locator, fromBeat, toBeat) => {
    const box = await locator.boundingBox();
    const y = box.y + box.height / 2;
    // Default zoom is 24 px per beat; the box starts at beat 0.
    await page.mouse.move(box.x + fromBeat * 24, y);
    await page.mouse.down();
    const seen = [];
    for (let i = 1; i <= 4; i++) {
      const beat = fromBeat + ((toBeat - fromBeat) * i) / 4;
      await page.mouse.move(box.x + beat * 24, y, { steps: 3 });
      seen.push(await position(page));
    }
    await page.mouse.up();
    return seen;
  };
  const noSelection = () =>
    page.evaluate(() => window.getSelection().toString() === "");

  const ruler = page.getByRole("slider", { name: "Playhead" });
  let seen = await scrubAlong(ruler, 2, 10);
  check(
    "dragging the ruler scrubs the playhead",
    seen.length === 4 &&
      new Set(seen).size === 4 &&
      seen.at(-1) === "Bar 3 · Beat 3",
    seen.join(" | "),
  );
  check("scrubbing the ruler selects no text", await noSelection());

  // Empty lane space (the clip sits at beats 16–24), dragging right to left
  // across the track header area's edge as well.
  const lane = page.locator('[data-track-id="t1"]');
  seen = await scrubAlong(lane, 12, 1);
  check(
    "dragging an empty lane scrubs the playhead",
    seen.at(-1) === "Bar 1 · Beat 2",
    seen.join(" | "),
  );
  check("scrubbing a lane selects no text", await noSelection());

  // Drags that start on text (a track name, a bar number) select nothing.
  for (const [what, start] of [
    ["track name", page.locator(".head .name").first()],
    ["bar number", page.locator(".ruler .label").nth(1)],
  ]) {
    const box = await start.boundingBox();
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + box.height / 2 + 40, {
      steps: 6,
    });
    await page.mouse.up();
    const selected = await page.evaluate(() =>
      window.getSelection().toString(),
    );
    check(
      `a drag from a ${what} selects no text`,
      selected === "",
      JSON.stringify(selected),
    );
  }

  // Dragging the clip still moves the clip, not the playhead.
  const before = await position(page);
  await dragBy(page, "A", "move", 4);
  const g = await geometry(page, "A");
  check(
    "dragging a clip still moves the clip, not the playhead",
    g.start === 20 && (await position(page)) === before,
    `clip at ${g.start}, playhead ${await position(page)}`,
  );
  await context.close();
}

async function calmLayout(browser) {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    const where = `${viewport.width}px`;
    const { context, page } = await start(browser, viewport);
    // Visible = inside the window and above the keyboard dock.
    const unhidden = (locator) =>
      locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const dockTop = document
          .querySelector(".dock")
          .getBoundingClientRect().top;
        return r.top >= 0 && r.bottom <= Math.min(dockTop, window.innerHeight);
      });
    const main = [
      page.getByRole("button", { name: "Play", exact: true }),
      page.getByRole("button", { name: "Back to start" }),
      page.getByRole("button", { name: "Record", exact: true }),
      page.getByLabel("Position"),
      page.locator("[data-clip-id]").first(),
    ];
    const seen = [];
    for (const l of main) seen.push(await unhidden(l));
    check(
      `${where}: first screen shows the main controls and the song without scrolling`,
      seen.every(Boolean),
      seen.join(","),
    );
    const settings = await page
      .locator("#panel-area :is(input, select, button)")
      .count();
    check(
      `${where}: no settings panel is open at first`,
      settings === 0,
      `${settings} controls`,
    );

    await openPanel(page, "Song");
    await openPanel(page, "Recording");
    const open = await page
      .getByRole("navigation", { name: "Panels" })
      .locator('button[aria-expanded="true"]')
      .allTextContents();
    check(
      `${where}: only one panel is open at a time`,
      open.length === 1 && open[0].trim() === "Recording",
      open.join(","),
    );
    await page.getByRole("button", { name: "Hide keyboard" }).click();
    await page.reload();
    await page.getByRole("button", { name: /press any key to start/i }).click();
    const reopened = await page
      .getByRole("navigation", { name: "Panels" })
      .locator('button[aria-expanded="true"]')
      .allTextContents();
    check(
      `${where}: the open panel and hidden keyboard are remembered`,
      reopened.join() === "Recording" &&
        (await page.getByRole("button", { name: "Show keyboard" }).count()) ===
          1 &&
        !(await page.locator("#keyboard").isVisible()),
      reopened.join(),
    );
    await context.close();
  }
}

/** Press Tab until `matches` is true for the focused element (no mouse). */
async function tabTo(page, description, matches) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(matches)) return true;
  }
  check(`Tab reaches ${description}`, false);
  return false;
}

/** The song as autosaved (written 0.8 s after the last change). */
/**
 * Press Pause if playback is still running. One step in the page: playback
 * can reach the song end and stop by itself between a separate "is Pause
 * there?" and the click, which would then wait for a button that is gone.
 */
async function pauseIfPlaying(page) {
  await page.evaluate(() => {
    const pause = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Pause",
    );
    pause?.click();
  });
}

async function savedSong(page) {
  await page.waitForTimeout(1000);
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("ajs-music.autosave.v2")),
  );
}

async function keyboardOnlyClipEdits(browser) {
  const { context, page } = await start(browser, {
    width: 1280,
    height: 800,
  });
  await openSong(
    page,
    songFile(120, [clip("A", 4, 4, 4, [note("n1", 60, 0)])], null, [
      track("t2", "Bass", []),
    ]),
    "keys.ajsong.json",
  );
  await page.locator("body").focus();
  const clips = page.locator("[data-clip-id]");
  await tabTo(
    page,
    "the clip",
    () => document.activeElement?.dataset.clipId === "A",
  );
  await page.keyboard.press("Enter");
  check(
    "Enter on a clip opens the inspector",
    await page.getByRole("region", { name: "Clip A" }).isVisible(),
  );

  async function typeInto(label, value) {
    const found = await tabTo(
      page,
      `the ${label} field`,
      new Function(
        `const l = document.activeElement?.closest("label"); return !!l && l.firstChild.textContent.trim() === ${JSON.stringify(label)};`,
      ),
    );
    if (!found) return;
    await page.keyboard.press("Control+A");
    await page.keyboard.type(String(value));
    await page.keyboard.press("Enter");
  }

  await typeInto("Name", "Hook");
  await typeInto("Start bar", 3);
  await typeInto("Beat", 2);
  await typeInto("Length", 8);
  await typeInto("Repeats every", 2);
  await typeInto("Higher / lower (steps)", 12);
  await page
    .getByRole("region", { name: /^Clip / })
    .getByRole("slider", { name: "Volume" })
    .fill("-6");
  let saved = await savedSong(page);
  const c = saved.tracks[0].clips[0];
  check(
    "typed fields change the clip",
    c.name === "Hook" &&
      c.startBeat === 9 &&
      c.lengthBeats === 8 &&
      c.loopBeats === 2 &&
      c.transpose === 12 &&
      c.gainDb === -6,
    JSON.stringify({ ...c, content: undefined }),
  );
  await page.getByLabel("Colour").fill("#ff0000");
  saved = await savedSong(page);
  check("colour can be set", saved.tracks[0].clips[0].colour === "#ff0000");
  await tabTo(page, "Use track colour", () =>
    document.activeElement?.textContent?.includes("Use track colour"),
  );
  await page.keyboard.press("Enter");
  saved = await savedSong(page);
  check("colour can be reset", saved.tracks[0].clips[0].colour === null);

  // Playhead to beat 10 (inside the clip, which spans 9..17), keys only.
  await tabTo(
    page,
    "the ruler",
    () => document.activeElement?.getAttribute("aria-label") === "Playhead",
  );
  await page.keyboard.press("Home");
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Control+KeyE");
  check("Ctrl+E splits at the playhead", (await clips.count()) === 2);
  await page.keyboard.press("Control+KeyD");
  check("Ctrl+D duplicates", (await clips.count()) === 3);
  await page.keyboard.press("Control+KeyC");
  // End = the song end, beat 17 (the right half of the split ends there).
  await page.keyboard.press("End");
  await page.keyboard.press("Control+KeyV");
  check("Ctrl+V pastes", (await clips.count()) === 4);
  saved = await savedSong(page);
  const pasted = saved.tracks[0].clips.at(-1);
  check(
    "paste lands at the playhead with the copied content",
    pasted.startBeat === 17 && pasted.content.notes.length === 1,
    `start ${pasted.startBeat}`,
  );
  await page.keyboard.press("Delete");
  check("Delete removes the selected clip", (await clips.count()) === 3);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Control+KeyZ");
  }
  check("each clip action is one undo step", (await clips.count()) === 1);
  await context.close();
}

// Real touch events (through the DevTools protocol) on a phone-sized page.
async function touchDrags(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => check("no page errors", false, e.message));
  await page.goto(URL);
  await page.getByRole("button", { name: /press any key to start/i }).tap();
  await openSong(
    page,
    songFile(120, [clip("A", 4, 4, 4, [])], null, [track("t2", "Bass", [])]),
    "touch.ajsong.json",
  );
  const cdp = await context.newCDPSession(page);
  async function swipe(x, y, dx, dy) {
    const at = (px, py) => [{ x: px, y: py, id: 1 }];
    const send = (type, touchPoints) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
    await send("touchStart", at(x, y));
    for (let i = 1; i <= 10; i++) {
      await send("touchMove", at(x + (dx * i) / 10, y + (dy * i) / 10));
    }
    await send("touchEnd", []);
    await page.waitForTimeout(200);
  }
  // Both lanes above the sticky keyboard dock, which covers the bottom.
  await page
    .locator(".scroller")
    .evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 120));
  const at = (g) => `start ${g.start}, length ${g.length}, ${g.lane}`;
  const clipBox = () => page.locator('[data-clip-id="A"]').boundingBox();

  let box = await clipBox();
  await swipe(box.x + box.width / 2, box.y + box.height / 2, 48, 0);
  let g = await geometry(page, "A");
  check("phone: touch drag moves a clip", g.start === 6, at(g));
  box = await clipBox();
  await swipe(box.x + box.width - 3, box.y + box.height / 2, 48, 0);
  g = await geometry(page, "A");
  check("phone: touch drag on the right edge stretches", g.length === 6, at(g));
  const laneHeight = await page
    .locator('[data-track-id="t2"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  box = await clipBox();
  await swipe(box.x + box.width / 2, box.y + box.height / 2, 0, laneHeight);
  g = await geometry(page, "A");
  check(
    "phone: touch drag moves a clip to another track",
    g.lane === "t2",
    at(g),
  );
  const lane = await page.locator('[data-track-id="t1"]').boundingBox();
  const before = await page
    .locator(".scroller")
    .evaluate((el) => el.scrollLeft);
  await swipe(360, lane.y + lane.height / 2, -150, 0);
  const after = await page.locator(".scroller").evaluate((el) => el.scrollLeft);
  check(
    "phone: swiping an empty lane still scrolls the timeline",
    after > before,
    `${before} -> ${after}`,
  );
  await context.close();
}

/** Reading settings (#88): fonts, text size, spacing, saved, nothing under 14px. */
// Owner report 2026-10-04: on a phone with larger text the keyboard dock
// covered the whole timeline and drum names broke one letter per line.
async function phoneLargeText(browser) {
  for (const [size, width, height] of [
    ["large", 412, 915],
    ["larger", 412, 915],
    ["large", 360, 740],
  ]) {
    const where = `${width}px ${size} text`;
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => check("no page errors", false, e.message));
    await page.addInitScript((s) => {
      localStorage.setItem("ajs-music.ui.text-size", s);
    }, size);
    await page.goto(URL);
    await page.getByRole("button", { name: /press any key to start/i }).click();
    await page.waitForTimeout(300);
    const layout = () =>
      page.evaluate(() => {
        const dock = document.querySelector(".dock").getBoundingClientRect();
        const lanes = document
          .querySelector(".track-lane, .lane, [data-track-id]")
          ?.getBoundingClientRect();
        const labels = [...document.querySelectorAll(".piano .note")]
          .filter((el) => el.textContent.trim())
          .map((el) => {
            const r = el.getBoundingClientRect();
            const line = parseFloat(getComputedStyle(el).lineHeight);
            return {
              text: el.textContent,
              lines: Math.round(r.height / line),
              right: r.right,
            };
          });
        return {
          dockTop: dock.top,
          laneTop: lanes?.top ?? Infinity,
          labels,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
    let m = await layout();
    check(
      `${where}: the first track is visible above the keyboard`,
      m.laneTop < m.dockTop,
      `track top ${Math.round(m.laneTop)}, keyboard top ${Math.round(m.dockTop)}`,
    );
    check(
      `${where}: note names stay on one line`,
      m.labels.every((l) => l.lines <= 1),
      m.labels
        .filter((l) => l.lines > 1)
        .map((l) => l.text)
        .join(" ") || "all one line",
    );
    // Drum track: each drum named once, whole word, inside the screen.
    const tabs = page.getByRole("navigation", { name: "Panels" });
    await tabs.getByRole("button", { name: "Track", exact: true }).click();
    await page.locator("#track-settings select").first().selectOption("noise");
    await tabs.getByRole("button", { name: "Track", exact: true }).click();
    m = await layout();
    const names = m.labels.map((l) => l.text).join(" ");
    check(
      `${where}: drum keys named once each`,
      names === "Kick Snare Hat",
      names,
    );
    check(
      `${where}: drum names are whole and on screen`,
      m.labels.every((l) => l.lines <= 1 && l.right <= width) &&
        m.scrollWidth <= width,
      JSON.stringify(m.labels),
    );
    await context.close();
  }
}

async function readingSettings(browser) {
  const bodyStyle = (page) =>
    page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return {
        family: s.fontFamily,
        size: parseFloat(s.fontSize),
        line: parseFloat(s.lineHeight),
      };
    });
  const choose = async (page, group, label) => {
    await openPanel(page, "Reading");
    await page
      .getByRole("group", { name: group })
      .getByLabel(label, { exact: true })
      .check();
  };
  const smallText = (page) =>
    page.evaluate(() => {
      const found = new Set();
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const el = node.parentElement;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || s.visibility === "hidden") {
          continue;
        }
        if (parseFloat(s.fontSize) < 14) {
          found.add(`${el.tagName}.${el.className}:${s.fontSize}`);
        }
      }
      return [...found];
    });

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    const where = `${viewport.width}px`;
    const { context, page } = await start(browser, viewport);
    const normal = await bodyStyle(page);

    for (const [label, name] of [
      ["Atkinson Hyperlegible", "Atkinson"],
      ["Lexend", "Lexend"],
      ["OpenDyslexic", "OpenDyslexic"],
    ]) {
      await choose(page, "Font", label);
      const { family } = await bodyStyle(page);
      check(
        `${where}: font ${label} changes the body font`,
        family.includes(name) && family !== normal.family,
        family,
      );
    }
    await choose(page, "Font", "System");
    check(
      `${where}: font System restores the default`,
      (await bodyStyle(page)).family === normal.family,
    );

    let small = await smallText(page);
    check(
      `${where}: no text under 14px (default)`,
      small.length === 0,
      small.join(" "),
    );

    await choose(page, "Text size", "Larger");
    const larger = await bodyStyle(page);
    check(
      `${where}: Larger increases the text size`,
      larger.size > normal.size,
      `${normal.size}px -> ${larger.size}px`,
    );
    small = await smallText(page);
    check(
      `${where}: no text under 14px (Larger)`,
      small.length === 0,
      small.join(" "),
    );

    await choose(page, "Spacing", "Relaxed");
    const relaxed = await bodyStyle(page);
    check(
      `${where}: Relaxed sets line height to at least 1.5 times the text size`,
      relaxed.line >= relaxed.size * 1.5 - 0.01,
      `${relaxed.line}px for ${relaxed.size}px`,
    );

    await choose(page, "Font", "OpenDyslexic");
    await page.waitForTimeout(300);
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(
      `${where}: no sideways page scroll with Larger, Relaxed and OpenDyslexic`,
      wide <= 0,
      `${wide}px over`,
    );

    await page.reload();
    await page.getByRole("button", { name: /press any key to start/i }).click();
    const after = await page.evaluate(() => ({
      ...document.documentElement.dataset,
      family: getComputedStyle(document.body).fontFamily,
    }));
    check(
      `${where}: reading settings survive a reload`,
      after.font === "opendyslexic" &&
        after.textSize === "larger" &&
        after.spacing === "relaxed" &&
        after.family.includes("OpenDyslexic"),
      JSON.stringify(after),
    );
    await openPanel(page, "Reading");
    check(
      `${where}: the Reading panel shows the saved choices`,
      await page
        .getByRole("group", { name: "Text size" })
        .getByLabel("Larger", { exact: true })
        .isChecked(),
    );
    await context.close();
  }
}

/** Document-space top of an element, so scrolling does not count as a move. */
const pageTop = (page, selector) =>
  page.evaluate(
    (sel) => document.querySelector(sel).getBoundingClientRect().top + scrollY,
    selector,
  );

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 800 },
];

async function focusAids(browser) {
  for (const viewport of VIEWPORTS) {
    const where = viewport.name;
    const { context, page } = await start(browser, viewport);
    const bar = page.locator(".rec-bar");
    const countIn = page.getByTestId("count-in");

    // Recording bar and the large count-in.
    await openSong(
      page,
      songFile(80, [clip("A", 0, 16, 16, [])]),
      "focus.ajsong.json",
    );
    await page.locator("[data-clip-id]").first().click();
    check(`${where}: no recording bar before recording`, !(await bar.count()));
    await page.getByRole("button", { name: "Record", exact: true }).click();
    const seen = [];
    const seenAt = Date.now();
    let barText = "";
    while (Date.now() - seenAt < 3600) {
      // Read both in one step: the count-in can end between a separate
      // "is it there?" and "what does it say?", which then waits forever.
      const now = await page.evaluate(() => ({
        n: document.querySelector('[data-testid="count-in"]')?.textContent,
        bar: document.querySelector(".rec-bar")?.textContent,
      }));
      if (now.n != null && seen[seen.length - 1] !== now.n.trim()) {
        seen.push(now.n.trim());
      }
      if (!barText && now.bar) barText = now.bar;
      await page.waitForTimeout(30);
    }
    check(
      `${where}: count-in shows 4, 3, 2, 1`,
      seen.join(",") === "4,3,2,1",
      seen.join(","),
    );
    check(
      `${where}: bar says what is being recorded into`,
      /Recording into A — press Record to stop/.test(
        barText.replace(/\s+/g, " "),
      ),
      barText.trim(),
    );
    check(
      `${where}: the bar is a status`,
      (await bar.getAttribute("role")) === "status",
    );
    check(`${where}: the count-in is gone after it`, !(await countIn.count()));
    check(`${where}: bar stays while recording`, (await bar.count()) === 1);
    await page.evaluate(() => scrollTo(0, 0));
    const box = await bar.boundingBox();
    const transport = await page.locator(".transport").boundingBox();
    check(
      `${where}: bar does not cover the transport controls`,
      // Above the transport on desktop; by the keys (below it) on a phone.
      box.y + box.height <= transport.y + 0.5 ||
        box.y >= transport.y + transport.height - 0.5,
      `bar ${box.y}–${box.y + box.height}, transport ${transport.y}–${transport.y + transport.height}`,
    );
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await page.waitForTimeout(150);
    check(`${where}: bar is gone after stopping`, !(await bar.count()));
    await page.getByRole("button", { name: "Back to start" }).click();

    // Deleting a clip, with Undo in the message.
    const clips = page.locator("[data-clip-id]");
    const message = page.locator(".deleted");
    await page.locator("[data-clip-id]").first().click();
    await page.getByRole("button", { name: "Delete clip" }).click();
    check(`${where}: delete clip removes it`, (await clips.count()) === 0);
    check(
      `${where}: message says Deleted A.`,
      (await message.textContent()).includes("Deleted A."),
    );
    check(
      `${where}: focus goes to the message's Undo`,
      await page.evaluate(
        () =>
          document.activeElement?.textContent?.trim() === "Undo" &&
          !!document.activeElement.closest(".deleted"),
      ),
    );
    await message.getByRole("button", { name: "Undo" }).click();
    check(
      `${where}: Undo in the message restores the clip`,
      (await clips.count()) === 1,
    );
    check(`${where}: the message goes after Undo`, !(await message.count()));
    check(
      `${where}: focus is not lost to the page`,
      await page.evaluate(() => document.activeElement !== document.body),
    );

    // Dismiss, with the keyboard.
    await page.locator("[data-clip-id]").first().click();
    await page.getByRole("button", { name: "Delete clip" }).click();
    await message.getByRole("button", { name: "Dismiss" }).click();
    check(`${where}: Dismiss removes the message`, !(await message.count()));
    check(
      `${where}: Dismiss does not bring the clip back`,
      (await clips.count()) === 0,
    );
    await page.keyboard.press("Control+KeyZ");
    check(`${where}: main Undo still restores it`, (await clips.count()) === 1);

    // Deleting a track.
    await context.close();
  }
  await focusAidsTrack(browser);
  await firstTimeHints(browser);
  await noLayoutJumps(browser);
}

async function focusAidsTrack(browser) {
  for (const viewport of VIEWPORTS) {
    const where = viewport.name;
    const { context, page } = await start(browser, viewport);
    await openSong(
      page,
      songFile(120, [clip("A", 0, 8, 8, [])], null, [track("t2", "Bass", [])]),
      "focus2.ajsong.json",
    );
    const lanes = () => page.locator("[data-track-id]").count();
    const before = await lanes();
    await openPanel(page, "Track");
    await page.getByRole("button", { name: "Delete Lead" }).click();
    const message = page.locator(".deleted");
    check(
      `${where}: delete track shows its message`,
      (await message.textContent()).includes("Deleted Lead."),
    );
    check(
      `${where}: a track is gone`,
      (await lanes()) === before - 1,
      `${before} -> ${await lanes()}`,
    );
    check(
      `${where}: focus is in the message`,
      await page.evaluate(() => !!document.activeElement?.closest(".deleted")),
    );
    await message.getByRole("button", { name: "Undo" }).click();
    check(`${where}: Undo restores the track`, (await lanes()) === before);
    check(
      `${where}: the track message goes after Undo`,
      !(await message.count()),
    );
    await context.close();
  }
}

async function firstTimeHints(browser) {
  for (const viewport of VIEWPORTS) {
    const where = viewport.name;
    const { context, page } = await start(browser, viewport);
    const timelineHint = page.locator('[data-hint="timeline"]');
    const chordHint = page.locator('[data-hint="chords"]');
    check(
      `${where}: timeline hint shows the first time`,
      (await timelineHint.count()) === 1,
    );
    check(
      `${where}: chord hint waits for the panel`,
      (await chordHint.count()) === 0,
    );
    await openPanel(page, "Chord builder");
    check(
      `${where}: chord hint shows the first time`,
      (await chordHint.count()) === 1,
    );
    await chordHint.getByRole("button", { name: "Got it" }).click();
    check(
      `${where}: Got it hides the chord hint`,
      (await chordHint.count()) === 0,
    );
    await page.reload();
    await page.getByRole("button", { name: /press any key to start/i }).click();
    await page.waitForTimeout(300);
    await openPanel(page, "Chord builder");
    check(
      `${where}: chord hint stays gone after a reload`,
      (await chordHint.count()) === 0,
    );
    check(
      `${where}: timeline hint still shows (not dismissed)`,
      (await timelineHint.count()) === 1,
    );
    await timelineHint.getByRole("button", { name: "Got it" }).click();
    await page.reload();
    await page.getByRole("button", { name: /press any key to start/i }).click();
    await page.waitForTimeout(300);
    check(
      `${where}: timeline hint stays gone after a reload`,
      (await timelineHint.count()) === 0,
    );
    await context.close();
  }
}

async function noLayoutJumps(browser) {
  for (const viewport of VIEWPORTS) {
    const where = viewport.name;
    const { context, page } = await start(browser, viewport);
    const spots = async () => [
      await pageTop(page, ".transport"),
      await pageTop(page, ".timeline"),
    ];
    const first = await spots();
    let same = true;
    for (const label of [
      "Track",
      "Clip",
      "Chord builder",
      "Recording",
      "Timeline",
      "Song",
      "Reading",
      "Save & export",
    ]) {
      await openPanel(page, label);
      const now = await spots();
      if (now[0] !== first[0] || now[1] !== first[1]) same = false;
    }
    check(
      `${where}: switching panels does not move the top bar or timeline`,
      same,
      `${first} -> ${await spots()}`,
    );
    await context.close();
  }
}

/** Serve the built app (dist/) with Vite's preview server. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** One PASS/FAIL per screen: serious or critical axe violations fail it. */
async function axeScan(page, name) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .analyze();
  const bad = violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const count = (impact) =>
    violations.filter((v) => v.impact === impact).length;
  check(
    `axe: ${name}`,
    bad.length === 0,
    `serious ${count("serious")}, critical ${count("critical")}, ` +
      `moderate ${count("moderate")}, minor ${count("minor")}`,
  );
  console.log(
    `AXE ${name} | serious ${count("serious")} | critical ${count("critical")} | moderate ${count("moderate")} | minor ${count("minor")}`,
  );
  for (const v of violations) {
    const targets = v.nodes.map((n) => n.target.join(" ")).join("; ");
    console.log(
      `  ${bad.includes(v) ? "VIOLATION" : "note"} [${v.impact}] ${v.id}: ${v.help} -> ${targets}`,
    );
  }
}

/** Accessibility scan (#90) of every screen, desktop and phone. */
async function accessibilityScan(browser) {
  for (const viewport of VIEWPORTS) {
    const w = viewport.name;
    const scan = (page, name) => axeScan(page, `${w} ${name}`);

    // Start overlay: before the first key press.
    {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(URL);
      await page
        .getByRole("button", { name: /press any key to start/i })
        .waitFor();
      await scan(page, "start overlay");
      await context.close();
    }

    // First screen (the timeline hint is showing), then each panel.
    {
      const { context, page } = await start(browser, viewport);
      await scan(page, "first screen");
      await scan(page, "first-time hint");
      await page
        .locator('[data-hint="timeline"]')
        .getByRole("button", { name: "Got it" })
        .click();
      await openSong(
        page,
        songFile(80, [clip("A", 0, 16, 16, [note("n1", 60, 0)])]),
        "axe.ajsong.json",
      );
      await page.locator("[data-clip-id]").first().click();
      for (const label of [
        "Track",
        "Clip",
        "Chord builder",
        "Recording",
        "Timeline",
        "Song",
        "Reading",
        "Save & export",
      ]) {
        await openPanel(page, label);
        await scan(page, `${label} panel`);
      }

      // Recording: the count-in, then the bar.
      await page.getByRole("button", { name: "Record", exact: true }).click();
      await page.getByTestId("count-in").waitFor();
      await scan(page, "count-in");
      await page.locator(".rec-bar").waitFor();
      await page.getByTestId("count-in").waitFor({ state: "detached" });
      await scan(page, "recording bar");
      await page.getByRole("button", { name: "Record", exact: true }).click();
      await page.waitForTimeout(150);

      // The Deleted/Undo message.
      await page.locator("[data-clip-id]").first().click();
      await page.getByRole("button", { name: "Delete clip" }).click();
      await page.locator(".deleted").waitFor();
      await scan(page, "deleted message");
      await context.close();
    }

    // Reading set to OpenDyslexic + Larger + Relaxed.
    {
      const { context, page } = await start(browser, viewport);
      await openPanel(page, "Reading");
      for (const [group, label] of [
        ["Font", "OpenDyslexic"],
        ["Text size", "Larger"],
        ["Spacing", "Relaxed"],
      ]) {
        await page
          .getByRole("group", { name: group })
          .getByLabel(label, { exact: true })
          .check();
      }
      await scan(page, "OpenDyslexic, Larger, Relaxed");
      await context.close();
    }
  }
}

/** Owner report #95 / #98: fast key presses dropped notes and glitched. */
async function keySpam(browser) {
  const { context, page } = await start(browser, { width: 1280, height: 800 });
  let dropped = 0;
  page.on("console", (m) => {
    if (/polyphony exceeded/i.test(m.text())) dropped++;
  });
  const keys = ["a", "s", "d", "f", "g", "h", "j", "w", "e"];
  for (let i = 0; i < 300; i++) {
    await page.keyboard.down(keys[i % keys.length]);
    if (i % 2) await page.keyboard.up(keys[(i - 1) % keys.length]);
  }
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(300);
  check(
    "300 fast key presses drop no notes",
    dropped === 0,
    `${dropped} dropped`,
  );
  await context.close();
}

async function startPreview() {
  const { preview } = await import("vite");
  const server = await preview({ preview: { port: 4173, open: false } });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("The preview server did not report an address.");
  return { server, url };
}

(async () => {
  let preview = null;
  if (!URL) {
    preview = await startPreview();
    URL = preview.url;
  }
  console.log(`Testing ${URL}`);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  try {
    await recordIntoClip(browser);
    await longTake(browser);
    await dragClips(browser);
    await keyboardOnlyClipEdits(browser);
    await touchDrags(browser);
    await chordBuilderClip(browser);
    await chordPads(browser);
    await scrubbing(browser);
    await calmLayout(browser);
    await stretchedClipRepeats(browser);
    await loopRegion(browser);
    await wavCoversSong(browser);
    await phone64Bars(browser);
    await readingSettings(browser);
    await phoneLargeText(browser);
    await focusAids(browser);
    await keySpam(browser);
    await accessibilityScan(browser);
  } finally {
    await browser.close();
    await preview?.server.close();
  }
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
