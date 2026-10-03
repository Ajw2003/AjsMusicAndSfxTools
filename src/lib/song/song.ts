import { getPreset, type ChiptuneSoundId } from "../audio/chiptune";

/** One recorded note. Times are in beats so tempo changes don't move notes. */
export interface Note {
  id: string;
  /** MIDI note number. */
  pitch: number;
  startBeat: number;
  durationBeats: number;
  /** 0 to 1. */
  velocity: number;
}

/** One instrument lane: a chiptune sound plus its notes. */
export interface Track {
  id: string;
  name: string;
  sound: ChiptuneSoundId;
  volumeDb: number;
  isMuted: boolean;
  notes: Note[];
}

/** A looping song. */
export interface Song {
  version: 1;
  bpm: number;
  bars: number;
  beatsPerBar: 4;
  tracks: Track[];
}

/** Every change to a song goes through one of these so it can be undone. */
export type SongCommand =
  | { type: "addTrack"; track: Track }
  | { type: "removeTrack"; trackId: string }
  | {
      type: "updateTrack";
      trackId: string;
      changes: Partial<Pick<Track, "name" | "sound" | "volumeDb" | "isMuted">>;
    }
  | { type: "addNotes"; trackId: string; notes: Note[] }
  | { type: "clearTrack"; trackId: string }
  | { type: "setBpm"; bpm: number }
  | { type: "setBars"; bars: number };

const MIN_BPM = 40;
const MAX_BPM = 240;
const MIN_BARS = 1;
const MAX_BARS = 8;
const MIN_NOTE_BEATS = 0.05;
const HISTORY_LIMIT = 200;

/** Create a new track with a fresh id; the name defaults to the sound's name. */
export function createTrack(sound: ChiptuneSoundId, name?: string): Track {
  return {
    id: crypto.randomUUID(),
    name: name ?? getPreset(sound).name,
    sound,
    volumeDb: 0,
    isMuted: false,
    notes: [],
  };
}

/** A new song: 110 BPM, 4 bars, one Square lead track. */
export function createSong(): Song {
  return {
    version: 1,
    bpm: 110,
    bars: 4,
    beatsPerBar: 4,
    tracks: [createTrack("square", "Square lead")],
  };
}

/** Length of the loop in beats. */
export function loopBeats(song: Song): number {
  return song.bars * song.beatsPerBar;
}

/** Snap a beat to the nearest grid line; a grid of 0 means no snapping. */
export function quantizeBeat(beat: number, grid: number): number {
  if (grid <= 0) return beat;
  return Math.round(beat / grid) * grid;
}

/**
 * Fold a note into the loop: its start wraps around, and its length is cut
 * so it never rings past the loop end (but never below a tiny minimum).
 */
export function wrapNoteToLoop(note: Note, loopLength: number): Note {
  // Double mod so negative starts wrap forwards.
  const startBeat = ((note.startBeat % loopLength) + loopLength) % loopLength;
  const durationBeats = Math.max(
    MIN_NOTE_BEATS,
    Math.min(note.durationBeats, loopLength - startBeat),
  );
  return { ...note, startBeat, durationBeats };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mapTrack(
  song: Song,
  trackId: string,
  fn: (track: Track) => Track,
): Song {
  if (!song.tracks.some((t) => t.id === trackId)) {
    throw new Error(`No track with id "${trackId}" in this song.`);
  }
  return {
    ...song,
    tracks: song.tracks.map((t) => (t.id === trackId ? fn(t) : t)),
  };
}

/** Apply a command, returning a new song; the input is never mutated. */
export function applyCommand(song: Song, cmd: SongCommand): Song {
  switch (cmd.type) {
    case "addTrack":
      return { ...song, tracks: [...song.tracks, cmd.track] };
    case "removeTrack":
      mapTrack(song, cmd.trackId, (t) => t); // validates the id
      return {
        ...song,
        tracks: song.tracks.filter((t) => t.id !== cmd.trackId),
      };
    case "updateTrack":
      return mapTrack(song, cmd.trackId, (t) => ({ ...t, ...cmd.changes }));
    case "addNotes":
      return mapTrack(song, cmd.trackId, (t) => ({
        ...t,
        notes: [...t.notes, ...cmd.notes],
      }));
    case "clearTrack":
      return mapTrack(song, cmd.trackId, (t) => ({ ...t, notes: [] }));
    case "setBpm":
      return { ...song, bpm: clamp(cmd.bpm, MIN_BPM, MAX_BPM) };
    case "setBars": {
      const bars = clamp(Math.round(cmd.bars), MIN_BARS, MAX_BARS);
      const length = bars * song.beatsPerBar;
      // Dropped (not hidden) so that undo, which restores the old snapshot,
      // brings the notes back.
      return {
        ...song,
        bars,
        tracks: song.tracks.map((t) => ({
          ...t,
          notes: t.notes.filter((n) => n.startBeat < length),
        })),
      };
    }
  }
}

type Listener = (song: Song) => void;

/** Holds the current song with undo/redo; usable as a Svelte store. */
export class SongHistory {
  #song: Song;
  #past: Song[] = [];
  #future: Song[] = [];
  #listeners = new Set<Listener>();

  constructor(song: Song) {
    this.#song = song;
  }

  /** The current song. */
  get song(): Song {
    return this.#song;
  }

  get canUndo(): boolean {
    return this.#past.length > 0;
  }

  get canRedo(): boolean {
    return this.#future.length > 0;
  }

  /** Apply a command and make it undoable; clears the redo stack. */
  apply(cmd: SongCommand): void {
    const next = applyCommand(this.#song, cmd);
    this.#past.push(this.#song);
    if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
    this.#future = [];
    this.#set(next);
  }

  /** Step back one change; false if there was nothing to undo. */
  undo(): boolean {
    const prev = this.#past.pop();
    if (!prev) return false;
    this.#future.push(this.#song);
    this.#set(prev);
    return true;
  }

  /** Step forward one change; false if there was nothing to redo. */
  redo(): boolean {
    const next = this.#future.pop();
    if (!next) return false;
    this.#past.push(this.#song);
    this.#set(next);
    return true;
  }

  /** Swap in a whole song (e.g. loaded from a file) and forget history. */
  replace(song: Song): void {
    this.#past = [];
    this.#future = [];
    this.#set(song);
  }

  /** Svelte-store-compatible: calls listener now and on each change. */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.#song);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #set(song: Song): void {
    this.#song = song;
    for (const l of [...this.#listeners]) l(song);
  }
}
