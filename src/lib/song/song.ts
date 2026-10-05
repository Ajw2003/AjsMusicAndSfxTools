import { getPreset, type ChiptuneSoundId } from "../audio/chiptune";
import type { ChordLabel } from "./chords";

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

export type TrackKind = "notes" | "audio";

export type ClipContent =
  /** Note times are beats from the start of the clip's source loop, within [0, loopBeats). */
  | {
      kind: "notes";
      notes: Note[];
      /** Chord names shown on the clip (chord-builder clips only). */
      labels?: ChordLabel[];
    }
  /** Used in a later phase; a type only for now. */
  | { kind: "audio"; assetId: string; sourceOffsetSeconds: number };

/** A stretch of a track on the timeline; its content repeats to fill it. */
export interface Clip {
  id: string;
  name: string;
  /** Where it sits on the timeline (>= 0). */
  startBeat: number;
  /** How long it lasts on the timeline (> 0). */
  lengthBeats: number;
  /** Length of the repeating source (> 0). */
  loopBeats: number;
  /** Trim: where in the source loop the clip begins, 0 <= offset < loopBeats. */
  offsetBeats: number;
  /** Semitones, note clips only, -24..24. */
  transpose: number;
  /** -30..+6. */
  gainDb: number;
  /** null = use the track/sound colour. */
  colour: string | null;
  content: ClipContent;
}

/** One instrument lane: a chiptune sound plus its clips. */
export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  sound: ChiptuneSoundId;
  volumeDb: number;
  isMuted: boolean;
  clips: Clip[];
}

/** A saved chord that can be played with one key. */
export interface ChordPad {
  id: string;
  name: string;
  pitches: number[];
  keyCode: string | null;
}

/** The part of the timeline that loops. */
export interface LoopRegion {
  startBeat: number;
  endBeat: number;
}

/** A song laid out on a timeline. */
export interface Song {
  version: 2;
  bpm: number;
  beatsPerBar: 4;
  tracks: Track[];
  loopRegion: LoopRegion | null;
  chordPads: ChordPad[];
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
  | { type: "addClip"; trackId: string; clip: Clip }
  | {
      type: "updateClip";
      clipId: string;
      changes: Partial<Omit<Clip, "id" | "content">>;
    }
  | { type: "moveClip"; clipId: string; toTrackId: string; startBeat: number }
  | { type: "removeClip"; clipId: string }
  | { type: "splitClip"; clipId: string; atBeat: number }
  | { type: "duplicateClip"; clipId: string; newClipId: string }
  | { type: "addNotesToClip"; clipId: string; notes: Note[] }
  | { type: "clearClip"; clipId: string }
  | { type: "setBpm"; bpm: number }
  | { type: "setLoopRegion"; region: LoopRegion | null }
  | { type: "setChordPads"; pads: ChordPad[] }
  /** Several commands applied as ONE undo step. */
  | { type: "batch"; commands: SongCommand[] };

const MIN_BPM = 40;
const MAX_BPM = 240;
export const MIN_NOTE_BEATS = 0.05;
const MIN_CLIP_BEATS = 0.25;
const MIN_SONG_BEATS = 16;
const HISTORY_LIMIT = 200;

/** Create a new track with a fresh id; the name defaults to the sound's name. */
export function createTrack(
  sound: ChiptuneSoundId,
  name?: string,
  kind: TrackKind = "notes",
): Track {
  return {
    id: crypto.randomUUID(),
    name: name ?? getPreset(sound).name,
    kind,
    sound,
    volumeDb: 0,
    isMuted: false,
    clips: [],
  };
}

/** A new empty note clip with default settings. */
export function createNoteClip(
  startBeat: number,
  loopBeats: number,
  name = "Clip",
): Clip {
  return {
    id: crypto.randomUUID(),
    name,
    startBeat,
    lengthBeats: loopBeats,
    loopBeats,
    offsetBeats: 0,
    transpose: 0,
    gainDb: 0,
    colour: null,
    content: { kind: "notes", notes: [] },
  };
}

/** A new song: 110 BPM, one Square lead track with one empty 4-bar clip. */
export function createSong(): Song {
  const track = createTrack("square", "Square lead");
  track.clips = [createNoteClip(0, 16)];
  return {
    version: 2,
    bpm: 110,
    beatsPerBar: 4,
    tracks: [track],
    loopRegion: { startBeat: 0, endBeat: 16 },
    chordPads: [],
  };
}

/** Find a clip and the track holding it. */
export function findClip(
  song: Song,
  clipId: string,
): { track: Track; clip: Clip } | null {
  for (const track of song.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

/** Where the last clip ends, at least 16 beats (4 bars). */
export function songEndBeat(song: Song): number {
  let end = MIN_SONG_BEATS;
  for (const t of song.tracks) {
    for (const c of t.clips) end = Math.max(end, c.startBeat + c.lengthBeats);
  }
  return end;
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

/**
 * The notes of a note clip as they sound on the timeline (absolute beats):
 * the source loop repeats from `offsetBeats`, only notes starting inside the
 * clip are kept, durations are cut at the clip end, and transpose is applied.
 * Ids are `${note.id}:${repeatIndex}`. Gain is left to the engine.
 */
export function expandClipNotes(clip: Clip): Note[] {
  if (clip.content.kind !== "notes") return [];
  const { loopBeats, offsetBeats, lengthBeats, startBeat } = clip;
  const out: Note[] = [];
  for (const n of clip.content.notes) {
    if (n.startBeat < 0 || n.startBeat >= loopBeats) continue;
    // Time from the clip start to the first sounding of this note.
    let rel = n.startBeat - offsetBeats;
    let repeat = 0;
    if (rel < 0) {
      rel += loopBeats;
      repeat = 1;
    }
    for (; rel < lengthBeats - 1e-9; rel += loopBeats, repeat++) {
      out.push({
        id: `${n.id}:${repeat}`,
        pitch: clamp(Math.round(n.pitch + clip.transpose), 0, 127),
        startBeat: startBeat + rel,
        durationBeats: Math.max(
          MIN_NOTE_BEATS,
          Math.min(n.durationBeats, lengthBeats - rel),
        ),
        velocity: n.velocity,
      });
    }
  }
  return out.sort((a, b) => a.startBeat - b.startBeat);
}

/** Expanded notes of a track's clips that start in [from, to). */
export function trackNotesInRange(
  track: Track,
  from: number,
  to: number,
): Note[] {
  const out: Note[] = [];
  for (const clip of track.clips) {
    for (const n of expandClipNotes(clip)) {
      if (n.startBeat >= from && n.startBeat < to) out.push(n);
    }
  }
  return out;
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

function mapClip(song: Song, clipId: string, fn: (clip: Clip) => Clip): Song {
  if (!findClip(song, clipId)) {
    throw new Error(`No clip with id "${clipId}" in this song.`);
  }
  return {
    ...song,
    tracks: song.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => (c.id === clipId ? fn(c) : c)),
    })),
  };
}

function mustFindClip(song: Song, clipId: string) {
  const found = findClip(song, clipId);
  if (!found) throw new Error(`No clip with id "${clipId}" in this song.`);
  return found;
}

function copyContent(content: ClipContent): ClipContent {
  if (content.kind !== "notes") return { ...content };
  const copy: ClipContent = {
    kind: "notes",
    notes: content.notes.map((n) => ({ ...n })),
  };
  if (content.labels) copy.labels = content.labels.map((l) => ({ ...l }));
  return copy;
}

function normalizeOffset(offset: number, loop: number): number {
  return ((offset % loop) + loop) % loop;
}

function updateClipFields(
  clip: Clip,
  changes: Partial<Omit<Clip, "id" | "content">>,
): Clip {
  const next = { ...clip, ...changes };
  next.startBeat = Math.max(0, next.startBeat);
  next.lengthBeats = Math.max(MIN_CLIP_BEATS, next.lengthBeats);
  next.loopBeats = Math.max(MIN_CLIP_BEATS, next.loopBeats);
  next.offsetBeats = normalizeOffset(next.offsetBeats, next.loopBeats);
  next.transpose = clamp(next.transpose, -24, 24);
  next.gainDb = clamp(next.gainDb, -30, 6);
  if (next.content.kind === "notes" && next.loopBeats < clip.loopBeats) {
    // Dropped (not hidden) so that undo, which restores the old snapshot,
    // brings the notes back.
    const limit = next.loopBeats;
    const { notes, labels } = next.content;
    next.content = {
      kind: "notes",
      notes: notes.filter((n) => n.startBeat < limit),
    };
    if (labels) {
      next.content.labels = labels.filter((l) => l.startBeat < limit);
    }
  }
  return next;
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
    case "addClip":
      return mapTrack(song, cmd.trackId, (t) => ({
        ...t,
        clips: [...t.clips, cmd.clip],
      }));
    case "updateClip":
      return mapClip(song, cmd.clipId, (c) => updateClipFields(c, cmd.changes));
    case "moveClip": {
      const found = mustFindClip(song, cmd.clipId);
      const to = song.tracks.find((t) => t.id === cmd.toTrackId);
      if (!to) {
        throw new Error(`No track with id "${cmd.toTrackId}" in this song.`);
      }
      if (to.kind !== found.track.kind) {
        throw new Error(
          `A clip can only move to a track of the same kind (${found.track.kind}).`,
        );
      }
      const moved = { ...found.clip, startBeat: Math.max(0, cmd.startBeat) };
      return {
        ...song,
        tracks: song.tracks.map((t) => {
          if (t.id === to.id && t.id === found.track.id) {
            return {
              ...t,
              clips: t.clips.map((c) => (c.id === cmd.clipId ? moved : c)),
            };
          }
          if (t.id === to.id) return { ...t, clips: [...t.clips, moved] };
          if (t.id === found.track.id) {
            return {
              ...t,
              clips: t.clips.filter((c) => c.id !== cmd.clipId),
            };
          }
          return t;
        }),
      };
    }
    case "removeClip":
      mustFindClip(song, cmd.clipId);
      return {
        ...song,
        tracks: song.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.id !== cmd.clipId),
        })),
      };
    case "splitClip": {
      const { track, clip: c } = mustFindClip(song, cmd.clipId);
      const end = c.startBeat + c.lengthBeats;
      if (!(cmd.atBeat > c.startBeat && cmd.atBeat < end)) {
        throw new Error("The split point must be inside the clip.");
      }
      const left: Clip = { ...c, lengthBeats: cmd.atBeat - c.startBeat };
      const right: Clip = {
        ...c,
        id: crypto.randomUUID(),
        startBeat: cmd.atBeat,
        lengthBeats: end - cmd.atBeat,
        offsetBeats: normalizeOffset(
          c.offsetBeats + (cmd.atBeat - c.startBeat),
          c.loopBeats,
        ),
        content: copyContent(c.content),
      };
      return mapTrack(song, track.id, (t) => ({
        ...t,
        clips: t.clips.flatMap((x) => (x.id === c.id ? [left, right] : [x])),
      }));
    }
    case "duplicateClip": {
      const { track, clip: c } = mustFindClip(song, cmd.clipId);
      const copy: Clip = {
        ...c,
        id: cmd.newClipId,
        startBeat: c.startBeat + c.lengthBeats,
        content: copyContent(c.content),
      };
      return mapTrack(song, track.id, (t) => ({
        ...t,
        clips: [...t.clips, copy],
      }));
    }
    case "addNotesToClip":
      return mapClip(song, cmd.clipId, (c) => {
        if (c.content.kind !== "notes") {
          throw new Error(`Clip "${cmd.clipId}" is not a note clip.`);
        }
        return {
          ...c,
          content: {
            ...c.content,
            notes: [...c.content.notes, ...cmd.notes],
          },
        };
      });
    case "clearClip":
      return mapClip(song, cmd.clipId, (c) =>
        c.content.kind === "notes"
          ? { ...c, content: { kind: "notes", notes: [] } }
          : c,
      );
    case "setBpm":
      return { ...song, bpm: clamp(cmd.bpm, MIN_BPM, MAX_BPM) };
    case "setLoopRegion": {
      const r = cmd.region;
      if (r && !(r.startBeat >= 0 && r.endBeat > r.startBeat)) {
        throw new Error(
          "The loop must start at 0 or later and end after it starts.",
        );
      }
      return { ...song, loopRegion: r ? { ...r } : null };
    }
    case "setChordPads":
      return { ...song, chordPads: cmd.pads };
    case "batch":
      return cmd.commands.reduce(applyCommand, song);
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

  /**
   * Apply a command as part of the LAST undo step (e.g. the bars of one
   * recording take), so one Undo removes the whole take.
   */
  amend(cmd: SongCommand): void {
    if (this.#past.length === 0) {
      this.apply(cmd);
      return;
    }
    this.#future = [];
    this.#set(applyCommand(this.#song, cmd));
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
