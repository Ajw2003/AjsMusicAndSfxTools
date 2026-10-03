import { describe, expect, it } from "vitest";
import {
  SongHistory,
  applyCommand,
  createNoteClip,
  createSong,
  createTrack,
  expandClipNotes,
  findClip,
  quantizeBeat,
  songEndBeat,
  wrapNoteToLoop,
  type Clip,
  type Note,
  type Song,
  type SongCommand,
} from "./song";

const note = (startBeat: number, durationBeats = 1, id = "n"): Note => ({
  id,
  pitch: 60,
  startBeat,
  durationBeats,
  velocity: 0.8,
});

const clipOf = (s: Song, i = 0) => s.tracks[0].clips[i];
const notesOf = (s: Song, i = 0) => {
  const c = clipOf(s, i).content;
  return c.kind === "notes" ? c.notes : [];
};

describe("createSong / createTrack", () => {
  it("makes the default song", () => {
    const s = createSong();
    expect(s).toMatchObject({
      version: 2,
      bpm: 110,
      beatsPerBar: 4,
      loopRegion: { startBeat: 0, endBeat: 16 },
      chordPads: [],
    });
    expect(s.tracks).toHaveLength(1);
    expect(s.tracks[0]).toMatchObject({
      name: "Square lead",
      kind: "notes",
      sound: "square",
      volumeDb: 0,
      isMuted: false,
    });
    expect(s.tracks[0].clips).toHaveLength(1);
    expect(s.tracks[0].clips[0]).toMatchObject({
      startBeat: 0,
      lengthBeats: 16,
      loopBeats: 16,
      offsetBeats: 0,
      content: { kind: "notes", notes: [] },
    });
    expect(songEndBeat(s)).toBe(16);
  });
  it("names tracks after the sound unless told otherwise", () => {
    expect(createTrack("noise").name).toBe("Noise drums");
    expect(createTrack("noise", "Hats").name).toBe("Hats");
    expect(createTrack("noise").id).not.toBe(createTrack("noise").id);
    expect(createTrack("noise").kind).toBe("notes");
    expect(createTrack("noise", "x", "audio").kind).toBe("audio");
  });
  it("finds clips and measures the song", () => {
    const s = createSong();
    const clip = s.tracks[0].clips[0];
    expect(findClip(s, clip.id)?.track.id).toBe(s.tracks[0].id);
    expect(findClip(s, "nope")).toBeNull();
    const longer = applyCommand(s, {
      type: "updateClip",
      clipId: clip.id,
      changes: { startBeat: 20 },
    });
    expect(songEndBeat(longer)).toBe(36);
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

describe("expandClipNotes", () => {
  const clip = (over: Partial<Clip>, notes: Note[]): Clip => ({
    ...createNoteClip(0, 4),
    ...over,
    content: { kind: "notes", notes },
  });
  it("repeats the source to fill the clip", () => {
    const out = expandClipNotes(clip({ lengthBeats: 10 }, [note(1, 1, "a")]));
    expect(out.map((n) => n.startBeat)).toEqual([1, 5, 9]);
    expect(out.map((n) => n.id)).toEqual(["a:0", "a:1", "a:2"]);
  });
  it("places notes relative to the clip start", () => {
    const out = expandClipNotes(
      clip({ startBeat: 8, lengthBeats: 4 }, [note(1)]),
    );
    expect(out.map((n) => n.startBeat)).toEqual([9]);
  });
  it("trims with the offset", () => {
    const out = expandClipNotes(
      clip({ offsetBeats: 1, lengthBeats: 4 }, [
        note(0, 1, "a"),
        note(1, 1, "b"),
        note(3, 1, "c"),
      ]),
    );
    // Source runs 1,2,3,0': b at 0, c at 2, a at 3.
    expect(out.map((n) => [n.id, n.startBeat])).toEqual([
      ["b:0", 0],
      ["c:0", 2],
      ["a:1", 3],
    ]);
  });
  it("cuts durations at the clip end", () => {
    const out = expandClipNotes(
      clip({ lengthBeats: 6 }, [note(3, 1, "a"), note(0, 4, "b")]),
    );
    expect(out.find((n) => n.id === "b:1")?.durationBeats).toBe(2);
    expect(out.find((n) => n.id === "a:1")).toBeUndefined();
    const tiny = expandClipNotes(
      clip({ lengthBeats: 4.01 }, [note(0, 4, "t")]),
    );
    expect(tiny.find((n) => n.id === "t:1")?.durationBeats).toBe(0.05);
  });
  it("drops notes outside the source loop", () => {
    expect(expandClipNotes(clip({}, [note(4), note(-1)]))).toEqual([]);
  });
  it("transposes and clamps pitch", () => {
    const hi: Note = { ...note(0), pitch: 125 };
    const lo: Note = { ...note(1, 1, "l"), pitch: 2 };
    expect(expandClipNotes(clip({ transpose: 12 }, [hi]))[0].pitch).toBe(127);
    expect(expandClipNotes(clip({ transpose: -12 }, [lo]))[0].pitch).toBe(0);
    expect(expandClipNotes(clip({ transpose: 2 }, [note(0)]))[0].pitch).toBe(
      62,
    );
  });
  it("does not change velocity and ignores audio clips", () => {
    expect(expandClipNotes(clip({ gainDb: -12 }, [note(0)]))[0].velocity).toBe(
      0.8,
    );
    const audio: Clip = {
      ...createNoteClip(0, 4),
      content: { kind: "audio", assetId: "a", sourceOffsetSeconds: 0 },
    };
    expect(expandClipNotes(audio)).toEqual([]);
  });
});

describe("applyCommand", () => {
  const base = (): Song => createSong();
  const id0 = (s: Song) => s.tracks[0].id;
  const cid = (s: Song) => s.tracks[0].clips[0].id;
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
    const out = applyCommand(s, {
      type: "updateTrack",
      trackId: id0(s),
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
  it("adds a clip", () => {
    const s = base();
    const c = createNoteClip(16, 8);
    const out = applyCommand(s, { type: "addClip", trackId: id0(s), clip: c });
    expect(out.tracks[0].clips.map((x) => x.id)).toEqual([cid(s), c.id]);
    expect(s.tracks[0].clips).toHaveLength(1);
  });
  it("updates a clip and validates fields", () => {
    const s = base();
    const out = applyCommand(s, {
      type: "updateClip",
      clipId: cid(s),
      changes: {
        name: "Verse",
        startBeat: -3,
        lengthBeats: 0,
        loopBeats: 0.1,
        offsetBeats: 5,
        transpose: 99,
        gainDb: -99,
        colour: "#ff0000",
      },
    });
    expect(clipOf(out)).toMatchObject({
      name: "Verse",
      startBeat: 0,
      lengthBeats: 0.25,
      loopBeats: 0.25,
      offsetBeats: 0,
      transpose: 24,
      gainDb: -30,
      colour: "#ff0000",
    });
    const hi = applyCommand(s, {
      type: "updateClip",
      clipId: cid(s),
      changes: { gainDb: 50, transpose: -50, offsetBeats: -1 },
    });
    expect(clipOf(hi)).toMatchObject({
      gainDb: 6,
      transpose: -24,
      offsetBeats: 15,
    });
    expect(clipOf(s).name).toBe("Clip");
  });
  it("drops notes beyond a shortened source loop, restored by undo", () => {
    const h = new SongHistory(base());
    const c = h.song.tracks[0].clips[0].id;
    h.apply({
      type: "addNotesToClip",
      clipId: c,
      notes: [note(1, 1, "in"), note(4, 1, "edge"), note(10, 1, "out")],
    });
    h.apply({ type: "updateClip", clipId: c, changes: { loopBeats: 4 } });
    expect(notesOf(h.song).map((n) => n.id)).toEqual(["in"]);
    h.undo();
    expect(notesOf(h.song)).toHaveLength(3);
  });
  it("moves a clip between tracks of the same kind", () => {
    const t2 = createTrack("pulse");
    const s = applyCommand(base(), { type: "addTrack", track: t2 });
    const out = applyCommand(s, {
      type: "moveClip",
      clipId: cid(s),
      toTrackId: t2.id,
      startBeat: 8,
    });
    expect(out.tracks[0].clips).toHaveLength(0);
    expect(out.tracks[1].clips[0]).toMatchObject({ id: cid(s), startBeat: 8 });
    // Same track: just changes the start, never below 0.
    const same = applyCommand(s, {
      type: "moveClip",
      clipId: cid(s),
      toTrackId: id0(s),
      startBeat: -5,
    });
    expect(same.tracks[0].clips).toHaveLength(1);
    expect(clipOf(same).startBeat).toBe(0);
  });
  it("refuses to move a clip to a track of another kind", () => {
    const t2 = createTrack("pulse", "Audio", "audio");
    const s = applyCommand(base(), { type: "addTrack", track: t2 });
    expect(() =>
      applyCommand(s, {
        type: "moveClip",
        clipId: cid(s),
        toTrackId: t2.id,
        startBeat: 0,
      }),
    ).toThrow("same kind");
  });
  it("removes a clip", () => {
    const s = base();
    const out = applyCommand(s, { type: "removeClip", clipId: cid(s) });
    expect(out.tracks[0].clips).toHaveLength(0);
    expect(s.tracks[0].clips).toHaveLength(1);
  });
  it("splits a clip with the right offset maths", () => {
    const s = base();
    const clipId = cid(s);
    const edited = applyCommand(
      applyCommand(s, {
        type: "addNotesToClip",
        clipId,
        notes: [note(2, 1, "a")],
      }),
      {
        type: "updateClip",
        clipId,
        changes: { startBeat: 4, lengthBeats: 32, offsetBeats: 6 },
      },
    );
    const out = applyCommand(edited, { type: "splitClip", clipId, atBeat: 14 });
    const [left, right] = out.tracks[0].clips;
    expect(left).toMatchObject({ id: clipId, startBeat: 4, lengthBeats: 10 });
    expect(right.id).not.toBe(clipId);
    expect(right).toMatchObject({
      startBeat: 14,
      lengthBeats: 22,
      loopBeats: 16,
      offsetBeats: (6 + 10) % 16,
    });
    expect(right.content).toEqual(left.content);
    expect(right.content).not.toBe(left.content);
    expect(left.offsetBeats).toBe(6);
    // The two halves sound exactly like the unsplit clip.
    const whole = expandClipNotes(clipOf(edited)).map((n) => n.startBeat);
    const halves = out.tracks[0].clips
      .flatMap((c) => expandClipNotes(c))
      .map((n) => n.startBeat);
    expect(halves).toEqual(whole);
  });
  it("rejects a split outside the clip", () => {
    const s = base();
    for (const atBeat of [0, 16, -1, 20]) {
      expect(() =>
        applyCommand(s, { type: "splitClip", clipId: cid(s), atBeat }),
      ).toThrow("inside");
    }
  });
  it("duplicates a clip right after the original", () => {
    const s = base();
    const withNote = applyCommand(s, {
      type: "addNotesToClip",
      clipId: cid(s),
      notes: [note(1, 1, "a")],
    });
    const out = applyCommand(withNote, {
      type: "duplicateClip",
      clipId: cid(s),
      newClipId: "copy",
    });
    const [orig, copy] = out.tracks[0].clips;
    expect(copy).toMatchObject({
      id: "copy",
      startBeat: orig.startBeat + orig.lengthBeats,
      lengthBeats: 16,
    });
    expect(copy.content).toEqual(orig.content);
    expect(copy.content).not.toBe(orig.content);
  });
  it("adds notes to a clip and clears it", () => {
    const s = base();
    const a = applyCommand(s, {
      type: "addNotesToClip",
      clipId: cid(s),
      notes: [note(0, 1, "a"), note(1, 1, "b")],
    });
    expect(notesOf(a)).toHaveLength(2);
    expect(notesOf(s)).toHaveLength(0);
    const c = applyCommand(a, { type: "clearClip", clipId: cid(s) });
    expect(notesOf(c)).toHaveLength(0);
    expect(notesOf(a)).toHaveLength(2);
  });
  it("refuses notes on an audio clip", () => {
    const s = base();
    const audio: Clip = {
      ...createNoteClip(0, 4),
      content: { kind: "audio", assetId: "a", sourceOffsetSeconds: 0 },
    };
    const out = applyCommand(s, {
      type: "addClip",
      trackId: id0(s),
      clip: audio,
    });
    expect(() =>
      applyCommand(out, {
        type: "addNotesToClip",
        clipId: audio.id,
        notes: [],
      }),
    ).toThrow("not a note clip");
  });
  it("clamps bpm", () => {
    const s = base();
    expect(applyCommand(s, { type: "setBpm", bpm: 10 }).bpm).toBe(40);
    expect(applyCommand(s, { type: "setBpm", bpm: 999 }).bpm).toBe(240);
    expect(applyCommand(s, { type: "setBpm", bpm: 128 }).bpm).toBe(128);
  });
  it("sets and clears the loop region, validating it", () => {
    const s = base();
    const out = applyCommand(s, {
      type: "setLoopRegion",
      region: { startBeat: 4, endBeat: 8 },
    });
    expect(out.loopRegion).toEqual({ startBeat: 4, endBeat: 8 });
    expect(
      applyCommand(out, { type: "setLoopRegion", region: null }).loopRegion,
    ).toBeNull();
    for (const region of [
      { startBeat: 4, endBeat: 4 },
      { startBeat: 8, endBeat: 4 },
      { startBeat: -1, endBeat: 4 },
    ]) {
      expect(() => applyCommand(s, { type: "setLoopRegion", region })).toThrow(
        "loop",
      );
    }
  });
  it("sets chord pads", () => {
    const pads = [{ id: "p", name: "C", pitches: [60, 64, 67], keyCode: null }];
    const out = applyCommand(base(), { type: "setChordPads", pads });
    expect(out.chordPads).toEqual(pads);
  });
  it("applies a batch as one undo step", () => {
    const h = new SongHistory(base());
    h.apply({
      type: "batch",
      commands: [
        { type: "setBpm", bpm: 90 },
        { type: "setLoopRegion", region: { startBeat: 0, endBeat: 4 } },
      ],
    });
    expect(h.song.bpm).toBe(90);
    h.undo();
    expect(h.song.bpm).toBe(110);
    expect(h.song.loopRegion?.endBeat).toBe(16);
    expect(h.canUndo).toBe(false);
  });
  it("throws naming an unknown id", () => {
    const s = base();
    const bad: SongCommand[] = [
      { type: "removeTrack", trackId: "ghost" },
      { type: "updateTrack", trackId: "ghost", changes: {} },
      { type: "addClip", trackId: "ghost", clip: createNoteClip(0, 4) },
      { type: "updateClip", clipId: "ghost", changes: {} },
      { type: "moveClip", clipId: "ghost", toTrackId: id0(s), startBeat: 0 },
      { type: "moveClip", clipId: cid(s), toTrackId: "ghost", startBeat: 0 },
      { type: "removeClip", clipId: "ghost" },
      { type: "splitClip", clipId: "ghost", atBeat: 1 },
      { type: "duplicateClip", clipId: "ghost", newClipId: "x" },
      { type: "addNotesToClip", clipId: "ghost", notes: [] },
      { type: "clearClip", clipId: "ghost" },
    ];
    for (const cmd of bad) {
      expect(() => applyCommand(s, cmd)).toThrow("ghost");
    }
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
  it("does not record a failed command", () => {
    const h = new SongHistory(createSong());
    expect(() => h.apply({ type: "clearClip", clipId: "ghost" })).toThrow(
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

describe("chord labels follow their clip", () => {
  const withLabels = (): Song => {
    const s = createSong();
    s.tracks[0].clips[0].content = {
      kind: "notes",
      notes: [note(0), note(8)],
      labels: [
        { startBeat: 0, name: "C" },
        { startBeat: 8, name: "G" },
      ],
    };
    return s;
  };
  const labelsOf = (s: Song, i = 0) => {
    const c = clipOf(s, i).content;
    return c.kind === "notes" ? c.labels?.map((l) => l.name) : undefined;
  };
  it("are copied by split and duplicate", () => {
    const s = withLabels();
    const id = clipOf(s).id;
    const split = applyCommand(s, { type: "splitClip", clipId: id, atBeat: 4 });
    expect(labelsOf(split, 1)).toEqual(["C", "G"]);
    const dup = applyCommand(s, {
      type: "duplicateClip",
      clipId: id,
      newClipId: "copy",
    });
    expect(labelsOf(dup, 1)).toEqual(["C", "G"]);
  });
  it("past a shortened loop are dropped with their notes", () => {
    const s = withLabels();
    const out = applyCommand(s, {
      type: "updateClip",
      clipId: clipOf(s).id,
      changes: { loopBeats: 8 },
    });
    expect(labelsOf(out)).toEqual(["C"]);
    expect(notesOf(out)).toHaveLength(1);
  });
  it("survive recording more notes, and go when the clip is cleared", () => {
    const s = withLabels();
    const id = clipOf(s).id;
    const more = applyCommand(s, {
      type: "addNotesToClip",
      clipId: id,
      notes: [note(2, 1, "x")],
    });
    expect(labelsOf(more)).toEqual(["C", "G"]);
    expect(labelsOf(applyCommand(s, { type: "clearClip", clipId: id }))).toBe(
      undefined,
    );
  });
});
