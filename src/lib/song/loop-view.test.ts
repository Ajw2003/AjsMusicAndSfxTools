import { describe, expect, it } from "vitest";
import {
  laneNotes,
  loopSpan,
  noteRects,
  noteSummary,
  positionLabel,
  workingNoteCount,
} from "./loop-view";
import { createNoteClip, createSong, createTrack, type Note } from "./song";

const n = (id: string, pitch: number, startBeat: number, d = 1): Note => ({
  id,
  pitch,
  startBeat,
  durationBeats: d,
  velocity: 0.8,
});

describe("loop view helpers", () => {
  it("centres single-pitch tracks", () => {
    const [r] = noteRects([n("a", 60, 4, 2)], 16);
    expect(r.left).toBe(25);
    expect(r.width).toBe(12.5);
    expect(r.top).toBe(40);
  });
  it("puts high pitches above low pitches", () => {
    const [lo, hi] = noteRects([n("a", 48, 0), n("b", 60, 1)], 16);
    expect(hi.top).toBe(0);
    expect(lo.top).toBe(80);
  });
  it("returns nothing for no notes", () => {
    expect(noteRects([], 16)).toEqual([]);
  });
  it("summarises counts", () => {
    expect(noteSummary(0)).toBe("No notes");
    expect(noteSummary(1)).toBe("1 note");
    expect(noteSummary(12)).toBe("12 notes");
  });
  it("labels positions", () => {
    expect(positionLabel(0, 4)).toBe("Bar 1 · Beat 1");
    expect(positionLabel(6.9, 4)).toBe("Bar 2 · Beat 3");
  });
});

describe("clip-aware lane helpers", () => {
  const track = () => {
    const t = createTrack("square");
    const clip = createNoteClip(4, 4);
    clip.lengthBeats = 8;
    clip.content = { kind: "notes", notes: [n("a", 60, 1)] };
    t.clips = [clip];
    return t;
  };
  it("uses the loop region, else the whole song", () => {
    const s = createSong();
    expect(loopSpan(s)).toEqual({ start: 0, end: 16 });
    s.loopRegion = null;
    expect(loopSpan(s)).toEqual({ start: 0, end: 16 });
  });
  it("shows expanded notes inside the span relative to its start", () => {
    const out = laneNotes(track(), { start: 4, end: 8 });
    expect(out.map((x) => x.startBeat)).toEqual([1]);
    const all = laneNotes(track(), { start: 0, end: 16 });
    expect(all.map((x) => x.startBeat)).toEqual([5, 9]);
  });
  it("counts notes in the working clip only", () => {
    expect(workingNoteCount(track())).toBe(1);
    expect(workingNoteCount(createTrack("square"))).toBe(0);
  });
});
