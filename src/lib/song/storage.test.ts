import { afterEach, describe, expect, it, vi } from "vitest";
import { createSong, createTrack } from "./song";
import {
  loadAutosave,
  parseSong,
  saveAutosave,
  serializeSong,
} from "./storage";

const KEY = "ajs-music.autosave.v1";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("serialize / parse", () => {
  it("round-trips a song with notes", () => {
    const s = createSong();
    s.tracks.push(createTrack("noise"));
    s.tracks[0].notes.push({
      id: "n1",
      pitch: 60,
      startBeat: 1.5,
      durationBeats: 0.5,
      velocity: 0.7,
    });
    expect(parseSong(serializeSong(s))).toEqual(s);
  });
  it("rejects bad JSON", () => {
    expect(() => parseSong("{nope")).toThrow("not valid JSON");
  });
  it("rejects non-objects and wrong versions", () => {
    expect(() => parseSong("[]")).toThrow("must be an object");
    const s = { ...createSong(), version: 2 };
    expect(() => parseSong(JSON.stringify(s))).toThrow("version");
  });
  it("rejects bad numbers", () => {
    const s = { ...createSong(), bpm: "fast" };
    expect(() => parseSong(JSON.stringify(s))).toThrow("bpm");
    // JSON turns NaN into null, which is not a finite number either.
    const n = { ...createSong(), bars: NaN };
    expect(() => parseSong(JSON.stringify(n))).toThrow("bars");
  });
  it("rejects unknown sounds and bad arrays", () => {
    const s = createSong();
    const bad = JSON.parse(serializeSong(s));
    bad.tracks[0].sound = "sax";
    expect(() => parseSong(JSON.stringify(bad))).toThrow('"sax"');
    const bad2 = JSON.parse(serializeSong(s));
    bad2.tracks[0].notes = "none";
    expect(() => parseSong(JSON.stringify(bad2))).toThrow("notes");
    const bad3 = JSON.parse(serializeSong(s));
    bad3.tracks = {};
    expect(() => parseSong(JSON.stringify(bad3))).toThrow("tracks");
  });
  it("rejects a bad note and names where", () => {
    const bad = JSON.parse(serializeSong(createSong()));
    bad.tracks[0].notes = [
      {
        id: "a",
        pitch: 60,
        startBeat: 0,
        durationBeats: Infinity,
        velocity: 1,
      },
    ];
    expect(() => parseSong(JSON.stringify(bad))).toThrow("Track 1 note 1");
  });
});

describe("autosave", () => {
  it("saves under the versioned key and loads it back", () => {
    const st = fakeStorage();
    const s = createSong();
    saveAutosave(st, s);
    expect(st.data.has(KEY)).toBe(true);
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
