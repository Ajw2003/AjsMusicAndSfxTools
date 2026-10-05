import {
  createNoteClip,
  expandClipNotes,
  findClip,
  quantizeBeat,
  wrapNoteToLoop,
  type Clip,
  type Note,
  type Song,
  type SongCommand,
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

/** Start of the first clip on `track` that starts after `beat`, or Infinity. */
export function nextClipStart(track: Track, beat: number): number {
  let next = Infinity;
  for (const c of track.clips) {
    if (c.startBeat > beat) next = Math.min(next, c.startBeat);
  }
  return next;
}

/**
 * The edit that stores notes from a recording take. Recording runs on in a
 * straight line, so the notes are in timeline beats and the target clip
 * grows (in whole bars) to cover them, up to the next clip on its track.
 * A "new" target becomes a clip only now, when there is something in it.
 * Returns null when there is nothing to store.
 */
export function recordedNotesEdit(
  song: Song,
  target: RecordTarget,
  notes: Note[],
  clipName: string,
): { command: SongCommand; clipId: string } | null {
  if (notes.length === 0) return null;
  const bpb = song.beatsPerBar;
  const roundUpToBar = (beats: number) =>
    Math.max(bpb, Math.ceil(beats / bpb - 1e-9) * bpb);
  const reach = (start: number) =>
    Math.max(...notes.map((n) => n.startBeat + n.durationBeats)) - start;

  if (target.kind === "new") {
    const track = song.tracks.find((t) => t.id === target.trackId);
    if (!track) return null;
    const room = nextClipStart(track, target.startBeat) - target.startBeat;
    const length = Math.min(roundUpToBar(reach(target.startBeat)), room);
    const clip = createNoteClip(target.startBeat, length, clipName);
    const inside = notes
      .map((n) => ({ ...n, startBeat: n.startBeat - target.startBeat }))
      .filter((n) => n.startBeat >= 0 && n.startBeat < length);
    return {
      clipId: clip.id,
      command: {
        type: "batch",
        commands: [
          { type: "addClip", trackId: track.id, clip },
          { type: "addNotesToClip", clipId: clip.id, notes: inside },
        ],
      },
    };
  }

  const found = findClip(song, target.clipId);
  if (!found) return null;
  const { clip, track } = found;
  const room = nextClipStart(track, clip.startBeat) - clip.startBeat;
  const length = Math.max(
    clip.lengthBeats,
    Math.min(roundUpToBar(reach(clip.startBeat)), room),
  );
  // A clip that plays its notes once grows its notes area with it; a clip
  // that repeats a shorter pattern keeps repeating it.
  const isRepeating = clip.loopBeats < clip.lengthBeats;
  const grown: Clip = {
    ...clip,
    lengthBeats: length,
    loopBeats: isRepeating ? clip.loopBeats : Math.max(clip.loopBeats, length),
  };
  const inside = notes
    .map((n) => ({ ...n, startBeat: n.startBeat - clip.startBeat }))
    .filter((n) => n.startBeat >= 0 && n.startBeat < length);
  const commands: SongCommand[] = [];
  if (length !== clip.lengthBeats || grown.loopBeats !== clip.loopBeats) {
    commands.push({
      type: "updateClip",
      clipId: clip.id,
      changes: { lengthBeats: grown.lengthBeats, loopBeats: grown.loopBeats },
    });
  }
  commands.push({
    type: "addNotesToClip",
    clipId: clip.id,
    notes: toClipSource(inside, grown),
  });
  return {
    clipId: clip.id,
    command: commands.length === 1 ? commands[0] : { type: "batch", commands },
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
  { value: 0, label: "Nothing" },
  { value: 1, label: "Beats" },
  { value: 4, label: "Bars" },
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

export interface PlacedLabel {
  id: string;
  name: string;
  /** Percent of the clip width. */
  left: number;
}

/** Chord names of a clip where they sound: repeated with the loop, trimmed by the offset. */
export function clipLabels(clip: Clip): PlacedLabel[] {
  if (clip.content.kind !== "notes" || !clip.content.labels) return [];
  const { loopBeats, offsetBeats, lengthBeats } = clip;
  const out: PlacedLabel[] = [];
  clip.content.labels.forEach((label, i) => {
    let rel = label.startBeat - offsetBeats;
    if (rel < 0) rel += loopBeats;
    for (let repeat = 0; rel < lengthBeats - 1e-9; rel += loopBeats, repeat++) {
      out.push({
        id: `${i}:${repeat}`,
        name: label.name,
        left: (rel / lengthBeats) * 100,
      });
    }
  });
  return out.sort((a, b) => a.left - b.left);
}
