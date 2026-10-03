import {
  songEndBeat,
  trackNotesInRange,
  type Clip,
  type Note,
  type Song,
  type Track,
} from "./song";

/** The stretch of timeline the user sees and loops: the loop region, else the whole song. */
export function loopSpan(song: Song): { start: number; end: number } {
  return song.loopRegion
    ? { start: song.loopRegion.startBeat, end: song.loopRegion.endBeat }
    : { start: 0, end: songEndBeat(song) };
}

/** A track's working clip: its first clip, which recording goes into. */
export function workingClip(track: Track): Clip | undefined {
  return track.clips[0];
}

/** Number of notes in the working clip. */
export function workingNoteCount(track: Track): number {
  const c = workingClip(track);
  return c && c.content.kind === "notes" ? c.content.notes.length : 0;
}

/** The notes shown in a lane: clips expanded, inside the span, relative to its start. */
export function laneNotes(
  track: Track,
  span: { start: number; end: number },
): Note[] {
  return trackNotesInRange(track, span.start, span.end).map((n) => ({
    ...n,
    startBeat: n.startBeat - span.start,
  }));
}

export interface NoteRect {
  id: string;
  /** Percent of lane width. */
  left: number;
  width: number;
  /** Percent of lane height for the block's top edge. */
  top: number;
}

/** Block height as a percent of lane height (used by the view). */
export const NOTE_HEIGHT_PCT = 20;

/** Place notes in a lane: x by time, y by pitch within the track's own range. */
export function noteRects(notes: Note[], loopLength: number): NoteRect[] {
  if (notes.length === 0) return [];
  const pitches = notes.map((n) => n.pitch);
  const min = Math.min(...pitches);
  const max = Math.max(...pitches);
  const span = 100 - NOTE_HEIGHT_PCT;
  return notes.map((n) => ({
    id: n.id,
    left: (n.startBeat / loopLength) * 100,
    width: Math.max(0.5, (n.durationBeats / loopLength) * 100),
    top: max === min ? span / 2 : (1 - (n.pitch - min) / (max - min)) * span,
  }));
}

/** "12 notes" / "1 note" / "No notes". */
export function noteSummary(count: number): string {
  if (count === 0) return "No notes";
  return count === 1 ? "1 note" : `${count} notes`;
}

/** "Bar 2 · Beat 3" for a loop position in beats. */
export function positionLabel(beat: number, beatsPerBar: number): string {
  const b = Math.max(0, beat);
  const bar = Math.floor(b / beatsPerBar) + 1;
  const inBar = Math.floor(b % beatsPerBar) + 1;
  return `Bar ${bar} · Beat ${inBar}`;
}
