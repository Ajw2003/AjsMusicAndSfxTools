import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  beatToPx,
  clampZoom,
  clipAtBeat,
  clipLabel,
  clipPreview,
  pxToBeat,
  recordTarget,
  repeatBoundaries,
  rulerTicks,
  snapDownToBar,
  stepZoom,
  timelineWidth,
  toClipSource,
  trackNoteCount,
} from "./timeline-view";
import { createNoteClip, createSong, createTrack, type Note } from "./song";

const n = (id: string, pitch: number, startBeat: number, d = 1): Note => ({
  id,
  pitch,
  startBeat,
  durationBeats: d,
  velocity: 0.8,
});

describe("zoom and pixel mapping", () => {
  it("maps beats to pixels and back at any zoom", () => {
    expect(beatToPx(4, 24)).toBe(96);
    expect(pxToBeat(96, 24)).toBe(4);
    expect(beatToPx(4, 48)).toBe(192);
    expect(pxToBeat(-10, 24)).toBe(0);
  });
  it("clamps and steps zoom", () => {
    expect(DEFAULT_ZOOM).toBe(24);
    expect(clampZoom(1)).toBe(MIN_ZOOM);
    expect(clampZoom(500)).toBe(MAX_ZOOM);
    expect(stepZoom(24, 1)).toBe(36);
    expect(stepZoom(24, -1)).toBe(16);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
  });
  it("timeline width is song end + 8 bars, at least the visible width", () => {
    expect(timelineWidth(16, 4, 10, 100)).toBe(480);
    expect(timelineWidth(16, 4, 10, 1000)).toBe(1000);
  });
});

describe("ruler ticks", () => {
  it("has bar and beat ticks with 1-based bar labels", () => {
    const t = rulerTicks(8, 4, 24);
    expect(t).toHaveLength(9);
    expect(t[0]).toEqual({ beat: 0, isBar: true, label: 1 });
    expect(t[1]).toEqual({ beat: 1, isBar: false, label: null });
    expect(t[4]).toEqual({ beat: 4, isBar: true, label: 2 });
  });
  it("drops beat ticks and thins labels when zoomed out", () => {
    const t = rulerTicks(32, 4, 6);
    expect(t.every((x) => x.isBar)).toBe(true);
    expect(t.filter((x) => x.label !== null).map((x) => x.label)).toEqual([
      1, 3, 5, 7, 9,
    ]);
  });
});

describe("clip lookup and record target", () => {
  const song = createSong();
  const track = song.tracks[0];
  const first = track.clips[0]; // 0..16
  const later = createNoteClip(32, 8);
  track.clips.push(later);

  it("finds the clip under a beat", () => {
    expect(clipAtBeat(track, 0)?.id).toBe(first.id);
    expect(clipAtBeat(track, 15.9)?.id).toBe(first.id);
    expect(clipAtBeat(track, 16)).toBeUndefined();
    expect(clipAtBeat(track, 33)?.id).toBe(later.id);
  });
  it("prefers the selected clip", () => {
    expect(recordTarget(song, track.id, later.id, 0)).toEqual({
      kind: "clip",
      clipId: later.id,
    });
  });
  it("falls back to the clip under the playhead, then a new clip on the bar", () => {
    expect(recordTarget(song, track.id, null, 3)).toEqual({
      kind: "clip",
      clipId: first.id,
    });
    expect(recordTarget(song, track.id, "gone", 21)).toEqual({
      kind: "new",
      trackId: track.id,
      startBeat: 20,
    });
  });
  it("snaps down to the bar", () => {
    expect(snapDownToBar(11.5, 4)).toBe(8);
    expect(snapDownToBar(-1, 4)).toBe(0);
  });
});

describe("recording into a clip", () => {
  it("shifts by the offset and wraps into the source loop", () => {
    const clip = { ...createNoteClip(8, 4), lengthBeats: 8, offsetBeats: 1 };
    const out = toClipSource([n("a", 60, 0), n("b", 62, 5, 3)], clip);
    expect(out.map((x) => x.startBeat)).toEqual([1, 2]);
    expect(out[1].durationBeats).toBe(2);
  });
});

describe("clip drawing", () => {
  it("labels a clip for screen readers", () => {
    const clip = { ...createNoteClip(8, 4), name: "Riff" };
    expect(clipLabel(clip, "Lead", 4)).toBe(
      "Clip Riff, track Lead, bar 3, 1 bar",
    );
    expect(clipLabel({ ...clip, lengthBeats: 8 }, "Lead", 4)).toBe(
      "Clip Riff, track Lead, bar 3, 2 bars",
    );
  });
  it("previews repeated notes and marks repeat boundaries", () => {
    const clip = {
      ...createNoteClip(4, 2),
      lengthBeats: 6,
      content: {
        kind: "notes" as const,
        notes: [n("a", 60, 0), n("b", 64, 1)],
      },
    };
    const r = clipPreview(clip);
    expect(r).toHaveLength(6);
    expect(r[0].left).toBe(0);
    expect(repeatBoundaries(clip).map((x) => Math.round(x))).toEqual([33, 67]);
  });
  it("counts notes on a track", () => {
    const t = createTrack("square");
    const c = createNoteClip(0, 4);
    c.content = { kind: "notes", notes: [n("a", 60, 0)] };
    t.clips = [c, createNoteClip(4, 4)];
    expect(trackNoteCount(t)).toBe(1);
  });
});
