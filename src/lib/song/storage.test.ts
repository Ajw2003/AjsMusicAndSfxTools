import { afterEach, describe, expect, it, vi } from "vitest";
import { createSong, createTrack } from "./song";
import {
  loadAutosave,
  parseSong,
  saveAutosave,
  serializeSong,
} from "./storage";

const KEY = "ajs-music.autosave.v2";
const KEY_V1 = "ajs-music.autosave.v1";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

/** A song in the exact shape version 1 of the app wrote. */
const v1Song = () => ({
  version: 1,
  bpm: 96,
  bars: 2,
  beatsPerBar: 4,
  tracks: [
    {
      id: "t1",
      name: "Square lead",
      sound: "square",
      volumeDb: -3,
      isMuted: false,
      notes: [
        { id: "a", pitch: 60, startBeat: 0, durationBeats: 1, velocity: 0.8 },
        { id: "b", pitch: 64, startBeat: 1.5, durationBeats: 0.5, velocity: 1 },
        { id: "c", pitch: 67, startBeat: 7, durationBeats: 1, velocity: 0.6 },
      ],
    },
    {
      id: "t2",
      name: "Noise drums",
      sound: "noise",
      volumeDb: 0,
      isMuted: true,
      notes: [],
    },
  ],
});

afterEach(() => vi.restoreAllMocks());

describe("serialize / parse", () => {
  it("round-trips a v2 song with notes, pads and no region", () => {
    const s = createSong();
    s.tracks.push(createTrack("noise"));
    const c = s.tracks[0].clips[0];
    c.colour = "#abcdef";
    c.content = {
      kind: "notes",
      notes: [
        {
          id: "n1",
          pitch: 60,
          startBeat: 1.5,
          durationBeats: 0.5,
          velocity: 0.7,
        },
      ],
    };
    s.chordPads = [
      { id: "p", name: "C", pitches: [60, 64, 67], keyCode: "KeyZ" },
    ];
    expect(parseSong(serializeSong(s))).toEqual(s);
    s.loopRegion = null;
    expect(parseSong(serializeSong(s))).toEqual(s);
  });
  it("round-trips an audio clip", () => {
    const s = createSong();
    s.tracks[0].kind = "audio";
    s.tracks[0].clips[0].content = {
      kind: "audio",
      assetId: "x",
      sourceOffsetSeconds: 1.25,
    };
    expect(parseSong(serializeSong(s))).toEqual(s);
  });
  it("rejects bad JSON", () => {
    expect(() => parseSong("{nope")).toThrow("not valid JSON");
  });
  it("rejects non-objects and wrong versions", () => {
    expect(() => parseSong("[]")).toThrow("must be an object");
    const s = { ...createSong(), version: 3 };
    expect(() => parseSong(JSON.stringify(s))).toThrow(
      "Unsupported song version: 3 (expected 1 or 2)",
    );
  });
  it("rejects bad numbers", () => {
    const s = { ...createSong(), bpm: "fast" };
    expect(() => parseSong(JSON.stringify(s))).toThrow("bpm");
    const n = { ...v1Song(), bars: NaN };
    // JSON turns NaN into null, which is not a finite number either.
    expect(() => parseSong(JSON.stringify(n))).toThrow("bars");
  });
  it("rejects unknown sounds, kinds and bad arrays", () => {
    const good = serializeSong(createSong());
    const bad = JSON.parse(good);
    bad.tracks[0].sound = "sax";
    expect(() => parseSong(JSON.stringify(bad))).toThrow('"sax"');
    const kind = JSON.parse(good);
    kind.tracks[0].kind = "video";
    expect(() => parseSong(JSON.stringify(kind))).toThrow("Track 1 kind");
    const clips = JSON.parse(good);
    clips.tracks[0].clips = "none";
    expect(() => parseSong(JSON.stringify(clips))).toThrow("Track 1 clips");
    const tracks = JSON.parse(good);
    tracks.tracks = {};
    expect(() => parseSong(JSON.stringify(tracks))).toThrow("tracks");
    const pads = JSON.parse(good);
    delete pads.chordPads;
    expect(() => parseSong(JSON.stringify(pads))).toThrow("chordPads");
  });
  it("rejects bad clips and names where", () => {
    const good = serializeSong(createSong());
    const cases: [(c: Record<string, unknown>) => void, string][] = [
      [(c) => (c.startBeat = -1), "Track 1 clip 1 startBeat must be 0 or more"],
      [
        (c) => (c.lengthBeats = 0),
        "Track 1 clip 1 lengthBeats must be above 0",
      ],
      [(c) => (c.loopBeats = -2), "Track 1 clip 1 loopBeats must be above 0"],
      [(c) => (c.offsetBeats = 16), "Track 1 clip 1 offsetBeats"],
      [(c) => (c.transpose = 30), "Track 1 clip 1 transpose must be between"],
      [(c) => (c.gainDb = 7), "Track 1 clip 1 gainDb must be between"],
      [(c) => (c.colour = 5), "Track 1 clip 1 colour"],
      [(c) => (c.content = { kind: "video" }), "content kind"],
      [
        (c) => (c.content = { kind: "notes", notes: 1 }),
        "notes must be a list",
      ],
      [
        (c) =>
          (c.content = {
            kind: "notes",
            notes: [
              {
                id: "a",
                pitch: 60,
                startBeat: 0,
                durationBeats: null,
                velocity: 1,
              },
            ],
          }),
        "Track 1 clip 1 note 1",
      ],
    ];
    for (const [mutate, message] of cases) {
      const bad = JSON.parse(good);
      mutate(bad.tracks[0].clips[0]);
      expect(() => parseSong(JSON.stringify(bad))).toThrow(message);
    }
  });
  it("rejects a bad loop region", () => {
    const bad = JSON.parse(serializeSong(createSong()));
    bad.loopRegion = { startBeat: 8, endBeat: 4 };
    expect(() => parseSong(JSON.stringify(bad))).toThrow("loopRegion");
    bad.loopRegion = "all";
    expect(() => parseSong(JSON.stringify(bad))).toThrow("loopRegion");
  });
  it("rejects a bad chord pad", () => {
    const bad = JSON.parse(serializeSong(createSong()));
    bad.chordPads = [{ id: "p", name: "C", pitches: "x", keyCode: null }];
    expect(() => parseSong(JSON.stringify(bad))).toThrow("Chord pad 1 pitches");
  });
});

describe("version 1 upgrade", () => {
  it("turns each track's notes into one clip covering the old loop", () => {
    const s = parseSong(JSON.stringify(v1Song()));
    expect(s).toMatchObject({
      version: 2,
      bpm: 96,
      beatsPerBar: 4,
      loopRegion: { startBeat: 0, endBeat: 8 },
      chordPads: [],
    });
    expect(s.tracks).toHaveLength(2);
    const [lead, drums] = s.tracks;
    expect(lead).toMatchObject({
      id: "t1",
      name: "Square lead",
      kind: "notes",
      sound: "square",
      volumeDb: -3,
      isMuted: false,
    });
    expect(lead.clips).toHaveLength(1);
    expect(lead.clips[0]).toMatchObject({
      name: "Square lead",
      startBeat: 0,
      lengthBeats: 8,
      loopBeats: 8,
      offsetBeats: 0,
      transpose: 0,
      gainDb: 0,
      colour: null,
    });
    expect(lead.clips[0].content).toEqual({
      kind: "notes",
      notes: v1Song().tracks[0].notes,
    });
    expect(drums.isMuted).toBe(true);
    expect(drums.clips).toHaveLength(1);
    expect(drums.clips[0].content).toEqual({ kind: "notes", notes: [] });
  });
  it("still validates version 1 data", () => {
    const bad = v1Song();
    (bad.tracks[0] as { sound: string }).sound = "sax";
    expect(() => parseSong(JSON.stringify(bad))).toThrow('"sax"');
    const zero = { ...v1Song(), bars: 0 };
    expect(() => parseSong(JSON.stringify(zero))).toThrow("bars");
  });
});

describe("autosave", () => {
  it("saves under the v2 key and loads it back", () => {
    const st = fakeStorage();
    const s = createSong();
    saveAutosave(st, s);
    expect(st.data.has(KEY)).toBe(true);
    expect(st.data.has(KEY_V1)).toBe(false);
    expect(loadAutosave(st)).toEqual(s);
  });
  it("upgrades an older v1 autosave when there is no v2 one", () => {
    const st = fakeStorage({ [KEY_V1]: JSON.stringify(v1Song()) });
    const s = loadAutosave(st);
    expect(s?.version).toBe(2);
    expect(s?.tracks[0].clips[0].lengthBeats).toBe(8);
  });
  it("prefers the v2 autosave over the v1 one", () => {
    const st = fakeStorage({ [KEY_V1]: JSON.stringify(v1Song()) });
    const s = createSong();
    saveAutosave(st, s);
    expect(loadAutosave(st)).toEqual(s);
  });
  it("returns null when missing, without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadAutosave(fakeStorage())).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
  it("warns and returns null when corrupt", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadAutosave(fakeStorage({ [KEY]: "garbage" }))).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain("not valid JSON");
  });
  it("never throws when storage throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const boom = () => {
      throw new Error("denied");
    };
    expect(loadAutosave({ getItem: boom })).toBeNull();
    expect(() => saveAutosave({ setItem: boom }, createSong())).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
