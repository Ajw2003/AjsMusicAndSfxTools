import { describe, expect, it } from "vitest";
import {
  SongHistory,
  applyCommand,
  createSong,
  createTrack,
  loopBeats,
  quantizeBeat,
  wrapNoteToLoop,
  type Note,
  type Song,
} from "./song";

const note = (startBeat: number, durationBeats = 1, id = "n"): Note => ({
  id,
  pitch: 60,
  startBeat,
  durationBeats,
  velocity: 0.8,
});

describe("createSong / createTrack", () => {
  it("makes the default song", () => {
    const s = createSong();
    expect(s).toMatchObject({ version: 1, bpm: 110, bars: 4, beatsPerBar: 4 });
    expect(s.tracks).toHaveLength(1);
    expect(s.tracks[0]).toMatchObject({
      name: "Square lead",
      sound: "square",
      volumeDb: 0,
      isMuted: false,
      notes: [],
    });
    expect(loopBeats(s)).toBe(16);
  });
  it("names tracks after the sound unless told otherwise", () => {
    expect(createTrack("noise").name).toBe("Noise drums");
    expect(createTrack("noise", "Hats").name).toBe("Hats");
    expect(createTrack("noise").id).not.toBe(createTrack("noise").id);
  });
});

describe("quantizeBeat", () => {
  it("snaps to the grid", () => {
    expect(quantizeBeat(1.3, 0.5)).toBe(1.5);
    expect(quantizeBeat(1.2, 0.5)).toBe(1);
    expect(quantizeBeat(0.74, 0.25)).toBe(0.75);
  });
  it("is off when the grid is 0", () => {
    expect(quantizeBeat(1.234, 0)).toBe(1.234);
  });
});

describe("wrapNoteToLoop", () => {
  it("wraps the start", () => {
    expect(wrapNoteToLoop(note(17), 16).startBeat).toBe(1);
    expect(wrapNoteToLoop(note(-1), 16).startBeat).toBe(15);
    expect(wrapNoteToLoop(note(16), 16).startBeat).toBe(0);
  });
  it("clips the end to the loop", () => {
    expect(wrapNoteToLoop(note(15, 4), 16).durationBeats).toBe(1);
    expect(wrapNoteToLoop(note(2, 1), 16).durationBeats).toBe(1);
  });
  it("keeps a minimum length", () => {
    expect(wrapNoteToLoop(note(15.99, 1), 16).durationBeats).toBe(0.05);
    expect(wrapNoteToLoop(note(1, 0), 16).durationBeats).toBe(0.05);
  });
  it("does not mutate", () => {
    const n = note(17);
    wrapNoteToLoop(n, 16);
    expect(n.startBeat).toBe(17);
  });
});

describe("applyCommand", () => {
  const base = (): Song => {
    const s = createSong();
    return s;
  };
  it("adds and removes tracks", () => {
    const s = base();
    const t = createTrack("pulse");
    const added = applyCommand(s, { type: "addTrack", track: t });
    expect(added.tracks).toHaveLength(2);
    expect(s.tracks).toHaveLength(1);
    const removed = applyCommand(added, { type: "removeTrack", trackId: t.id });
    expect(removed.tracks.map((x) => x.id)).toEqual([s.tracks[0].id]);
  });
  it("updates a track", () => {
    const s = base();
    const id = s.tracks[0].id;
    const out = applyCommand(s, {
      type: "updateTrack",
      trackId: id,
      changes: { name: "Lead", isMuted: true, volumeDb: -6, sound: "pulse" },
    });
    expect(out.tracks[0]).toMatchObject({
      name: "Lead",
      isMuted: true,
      volumeDb: -6,
      sound: "pulse",
    });
    expect(s.tracks[0].name).toBe("Square lead");
  });
  it("adds notes and clears a track", () => {
    const s = base();
    const id = s.tracks[0].id;
    const a = applyCommand(s, {
      type: "addNotes",
      trackId: id,
      notes: [note(0, 1, "a"), note(1, 1, "b")],
    });
    expect(a.tracks[0].notes).toHaveLength(2);
    expect(s.tracks[0].notes).toHaveLength(0);
    const c = applyCommand(a, { type: "clearTrack", trackId: id });
    expect(c.tracks[0].notes).toHaveLength(0);
    expect(a.tracks[0].notes).toHaveLength(2);
  });
  it("clamps bpm", () => {
    const s = base();
    expect(applyCommand(s, { type: "setBpm", bpm: 10 }).bpm).toBe(40);
    expect(applyCommand(s, { type: "setBpm", bpm: 999 }).bpm).toBe(240);
    expect(applyCommand(s, { type: "setBpm", bpm: 128 }).bpm).toBe(128);
  });
  it("clamps bars and drops notes beyond the new loop", () => {
    const s = base();
    const id = s.tracks[0].id;
    const withNotes = applyCommand(s, {
      type: "addNotes",
      trackId: id,
      notes: [note(1, 1, "in"), note(4, 1, "edge"), note(10, 1, "out")],
    });
    const shorter = applyCommand(withNotes, { type: "setBars", bars: 1 });
    expect(shorter.bars).toBe(1);
    expect(shorter.tracks[0].notes.map((n) => n.id)).toEqual(["in"]);
    expect(withNotes.tracks[0].notes).toHaveLength(3);
    expect(applyCommand(s, { type: "setBars", bars: 0 }).bars).toBe(1);
    expect(applyCommand(s, { type: "setBars", bars: 99 }).bars).toBe(8);
  });
  it("throws naming an unknown track id", () => {
    const s = base();
    expect(() =>
      applyCommand(s, { type: "removeTrack", trackId: "ghost" }),
    ).toThrow("ghost");
    expect(() =>
      applyCommand(s, { type: "clearTrack", trackId: "ghost" }),
    ).toThrow("ghost");
    expect(() =>
      applyCommand(s, { type: "addNotes", trackId: "ghost", notes: [] }),
    ).toThrow("ghost");
    expect(() =>
      applyCommand(s, { type: "updateTrack", trackId: "ghost", changes: {} }),
    ).toThrow("ghost");
  });
});

describe("SongHistory", () => {
  it("undoes and redoes in order", () => {
    const h = new SongHistory(createSong());
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(false);
    h.apply({ type: "setBpm", bpm: 100 });
    h.apply({ type: "setBpm", bpm: 120 });
    expect(h.song.bpm).toBe(120);
    expect(h.undo()).toBe(true);
    expect(h.song.bpm).toBe(100);
    expect(h.undo()).toBe(true);
    expect(h.song.bpm).toBe(110);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toBe(true);
    expect(h.song.bpm).toBe(100);
    expect(h.redo()).toBe(true);
    expect(h.song.bpm).toBe(120);
    expect(h.canRedo).toBe(false);
  });
  it("clears redo after a new apply", () => {
    const h = new SongHistory(createSong());
    h.apply({ type: "setBpm", bpm: 100 });
    h.undo();
    h.apply({ type: "setBpm", bpm: 90 });
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBe(false);
  });
  it("restores notes dropped by setBars on undo", () => {
    const s = createSong();
    const h = new SongHistory(s);
    h.apply({ type: "addNotes", trackId: s.tracks[0].id, notes: [note(10)] });
    h.apply({ type: "setBars", bars: 1 });
    expect(h.song.tracks[0].notes).toHaveLength(0);
    h.undo();
    expect(h.song.tracks[0].notes).toHaveLength(1);
  });
  it("does not record a failed command", () => {
    const h = new SongHistory(createSong());
    expect(() => h.apply({ type: "clearTrack", trackId: "ghost" })).toThrow(
      "ghost",
    );
    expect(h.canUndo).toBe(false);
  });
  it("caps history at 200 entries", () => {
    const h = new SongHistory(createSong());
    for (let i = 0; i < 250; i++)
      h.apply({ type: "setBpm", bpm: 40 + (i % 100) });
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(200);
  });
  it("replace swaps the song and clears history", () => {
    const h = new SongHistory(createSong());
    h.apply({ type: "setBpm", bpm: 100 });
    h.undo();
    const other = createSong();
    h.replace(other);
    expect(h.song).toBe(other);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
  it("subscribes immediately, on change, and can unsubscribe", () => {
    const h = new SongHistory(createSong());
    const seen: number[] = [];
    const off = h.subscribe((s) => seen.push(s.bpm));
    expect(seen).toEqual([110]);
    h.apply({ type: "setBpm", bpm: 90 });
    h.undo();
    expect(seen).toEqual([110, 90, 110]);
    off();
    h.apply({ type: "setBpm", bpm: 80 });
    expect(seen).toHaveLength(3);
  });
});
