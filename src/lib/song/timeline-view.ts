import {
  expandClipNotes,
  quantizeBeat,
  wrapNoteToLoop,
  type Clip,
  type Note,
  type Song,
  type Track,
} from "./song";

/** Pixels per beat: the zoom range and its starting value. */
export const MIN_ZOOM = 6;
export const MAX_ZOOM = 80;
export const DEFAULT_ZOOM = 24;
/** Each zoom button press multiplies or divides pixels-per-beat by this. */
export const ZOOM_STEP = 1.5;
/** Empty bars shown after the last clip so there is room to add more. */
export const EXTRA_BARS = 8;

export function clampZoom(pxPerBeat: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pxPerBeat));
}

/** One zoom step in (direction 1) or out (direction -1), clamped. */
export function stepZoom(pxPerBeat: number, direction: 1 | -1): number {
  return clampZoom(
    direction > 0 ? pxPerBeat * ZOOM_STEP : pxPerBeat / ZOOM_STEP,
  );
}

export function beatToPx(beat: number, pxPerBeat: number): number {
  return beat * pxPerBeat;
}

/** Pixel offset inside the timeline content to a beat (never below 0). */
export function pxToBeat(px: number, pxPerBeat: number): number {
  return Math.max(0, px / pxPerBeat);
}

/** Width of the timeline content: song end plus 8 bars, at least the visible width. */
export function timelineWidth(
  endBeat: number,
  beatsPerBar: number,
  pxPerBeat: number,
  visibleWidth: number,
): number {
  return Math.max(
    (endBeat + EXTRA_BARS * beatsPerBar) * pxPerBeat,
    visibleWidth,
  );
}

export interface RulerTick {
  beat: number;
  isBar: boolean;
  /** 1-based bar number when this tick carries a label, else null. */
  label: number | null;
}

/**
 * Ticks for the ruler over [0, totalBeats]. Beat ticks are left out when
 * they would be closer than 8 px; bar labels are thinned so they never sit
 * closer than about 32 px.
 */
export function rulerTicks(
  totalBeats: number,
  beatsPerBar: number,
  pxPerBeat: number,
): RulerTick[] {
  const showBeats = pxPerBeat >= 8;
  const barPx = beatsPerBar * pxPerBeat;
  let labelEvery = 1;
  while (barPx * labelEvery < 32) labelEvery *= 2;
  const out: RulerTick[] = [];
  for (let beat = 0; beat <= totalBeats; beat++) {
    const isBar = beat % beatsPerBar === 0;
    if (!isBar && !showBeats) continue;
    const bar = beat / beatsPerBar;
    out.push({
      beat,
      isBar,
      label: isBar && bar % labelEvery === 0 ? bar + 1 : null,
    });
  }
  return out;
}

export function snapDownToBar(beat: number, beatsPerBar: number): number {
  return Math.floor(Math.max(0, beat) / beatsPerBar) * beatsPerBar;
}

/** The clip on a track covering `beat` (start inclusive, end exclusive); the last one wins. */
export function clipAtBeat(track: Track, beat: number): Clip | undefined {
  let found: Clip | undefined;
  for (const c of track.clips) {
    if (beat >= c.startBeat && beat < c.startBeat + c.lengthBeats) found = c;
  }
  return found;
}

export type RecordTarget =
  | { kind: "clip"; clipId: string }
  | { kind: "new"; trackId: string; startBeat: number };

/**
 * Where Record puts notes: the selected clip; else the selected track's note
 * clip under the playhead; else a new clip at the playhead (snapped to the bar).
 */
export function recordTarget(
  song: Song,
  selectedTrackId: string,
  selectedClipId: string | null,
  playheadBeat: number,
): RecordTarget {
  if (selectedClipId) {
    for (const t of song.tracks) {
      const c = t.clips.find((x) => x.id === selectedClipId);
      if (c && c.content.kind === "notes") {
        return { kind: "clip", clipId: c.id };
      }
    }
  }
  const track = song.tracks.find((t) => t.id === selectedTrackId);
  const under = track && clipAtBeat(track, playheadBeat);
  if (under && under.content.kind === "notes") {
    return { kind: "clip", clipId: under.id };
  }
  return {
    kind: "new",
    trackId: selectedTrackId,
    startBeat: snapDownToBar(playheadBeat, song.beatsPerBar),
  };
}

/**
 * Notes recorded against a clip's span (start 0 = clip start) moved into its
 * source loop: shifted by the trim offset and wrapped to `loopBeats`.
 */
export function toClipSource(notes: Note[], clip: Clip): Note[] {
  return notes.map((n) =>
    wrapNoteToLoop(
      { ...n, startBeat: n.startBeat + clip.offsetBeats },
      clip.loopBeats,
    ),
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Accessible name for a clip block. */
export function clipLabel(
  clip: Clip,
  trackName: string,
  beatsPerBar: number,
): string {
  const bar = Math.floor(clip.startBeat / beatsPerBar) + 1;
  const len = Math.round((clip.lengthBeats / beatsPerBar) * 100) / 100;
  return `Clip ${clip.name}, track ${trackName}, bar ${bar}, ${plural(len, "bar")}`;
}

export interface PreviewRect {
  id: string;
  /** Percent of the clip width / height. */
  left: number;
  width: number;
  top: number;
}

/** Block height of a preview note as a percent of the preview height. */
export const PREVIEW_NOTE_PCT = 18;

/** Mini note preview for a clip: expanded notes placed by time and pitch. */
export function clipPreview(clip: Clip): PreviewRect[] {
  const notes = expandClipNotes(clip);
  if (notes.length === 0) return [];
  const pitches = notes.map((n) => n.pitch);
  const min = Math.min(...pitches);
  const max = Math.max(...pitches);
  const span = 100 - PREVIEW_NOTE_PCT;
  return notes.map((n) => ({
    id: n.id,
    left: ((n.startBeat - clip.startBeat) / clip.lengthBeats) * 100,
    width: Math.max(0.5, (n.durationBeats / clip.lengthBeats) * 100),
    top: max === min ? span / 2 : (1 - (n.pitch - min) / (max - min)) * span,
  }));
}

/** Where the source loop starts again inside a clip, as percents of its width. */
export function repeatBoundaries(clip: Clip): number[] {
  const out: number[] = [];
  for (
    let rel = clip.loopBeats - clip.offsetBeats;
    rel < clip.lengthBeats - 1e-9;
    rel += clip.loopBeats
  ) {
    if (rel > 1e-9) out.push((rel / clip.lengthBeats) * 100);
  }
  return out;
}

/** Number of source notes across a track's note clips. */
export function trackNoteCount(track: Track): number {
  let n = 0;
  for (const c of track.clips) {
    if (c.content.kind === "notes") n += c.content.notes.length;
  }
  return n;
}

/** Which part of a clip a drag moves: all of it, its right edge, or its left edge. */
export type DragMode = "move" | "stretch" | "trim";

/** The shortest a drag can make a clip, so it never vanishes under the pointer. */
export const MIN_DRAG_BEATS = 0.25;

/** Snap choices for dragging, in beats per grid line; 0 is off. */
export const SNAP_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 1, label: "Beat" },
  { value: 4, label: "Bar" },
] as const;

export type ClipPlacement = Pick<
  Clip,
  "startBeat" | "lengthBeats" | "offsetBeats"
>;

/**
 * Where a clip ends up after dragging by `deltaBeats`. The edge being moved
 * snaps to the absolute grid (not by the drag distance), so a clip that is
 * off the grid lands on it. Stretching keeps the source loop, so content
 * repeats; trimming the left edge shifts the trim offset so the notes that
 * stay keep their place on the timeline.
 */
export function dragClip(
  clip: Clip,
  mode: DragMode,
  deltaBeats: number,
  grid: number,
): ClipPlacement {
  const { startBeat, lengthBeats, offsetBeats, loopBeats } = clip;
  const end = startBeat + lengthBeats;
  // Never shorter than one grid step (or the minimum when snap is off).
  const minLength = Math.max(MIN_DRAG_BEATS, grid);
  if (mode === "move") {
    return {
      startBeat: Math.max(0, quantizeBeat(startBeat + deltaBeats, grid)),
      lengthBeats,
      offsetBeats,
    };
  }
  if (mode === "stretch") {
    const newEnd = quantizeBeat(end + deltaBeats, grid);
    return {
      startBeat,
      lengthBeats: Math.max(minLength, newEnd - startBeat),
      offsetBeats,
    };
  }
  const newStart = Math.min(
    end - minLength,
    Math.max(0, quantizeBeat(startBeat + deltaBeats, grid)),
  );
  const shift = newStart - startBeat;
  return {
    startBeat: newStart,
    lengthBeats: end - newStart,
    offsetBeats: (((offsetBeats + shift) % loopBeats) + loopBeats) % loopBeats,
  };
}
