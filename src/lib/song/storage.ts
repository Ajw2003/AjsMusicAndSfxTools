import { CHIPTUNE_PRESETS } from "../audio/chiptune";
import type { Note, Song, Track } from "./song";

const AUTOSAVE_KEY = "ajs-music.autosave.v1";

/** Turn a song into JSON text for autosave or a project file. */
export function serializeSong(song: Song): string {
  return JSON.stringify(song);
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finite(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`${what} must be a finite number.`);
  }
  return v;
}

function str(v: unknown, what: string): string {
  if (typeof v !== "string") throw new Error(`${what} must be text.`);
  return v;
}

function parseNote(v: unknown, where: string): Note {
  if (!isObj(v)) throw new Error(`${where} must be an object.`);
  return {
    id: str(v.id, `${where} id`),
    pitch: finite(v.pitch, `${where} pitch`),
    startBeat: finite(v.startBeat, `${where} startBeat`),
    durationBeats: finite(v.durationBeats, `${where} durationBeats`),
    velocity: finite(v.velocity, `${where} velocity`),
  };
}

function parseTrack(v: unknown, where: string): Track {
  if (!isObj(v)) throw new Error(`${where} must be an object.`);
  const sound = v.sound;
  const preset = CHIPTUNE_PRESETS.find((p) => p.id === sound);
  if (!preset) {
    throw new Error(`${where} has an unknown sound "${String(sound)}".`);
  }
  if (typeof v.isMuted !== "boolean") {
    throw new Error(`${where} isMuted must be true or false.`);
  }
  if (!Array.isArray(v.notes))
    throw new Error(`${where} notes must be a list.`);
  return {
    id: str(v.id, `${where} id`),
    name: str(v.name, `${where} name`),
    sound: preset.id,
    volumeDb: finite(v.volumeDb, `${where} volumeDb`),
    isMuted: v.isMuted,
    notes: v.notes.map((n, i) => parseNote(n, `${where} note ${i + 1}`)),
  };
}

/** Parse and strictly validate song JSON; throws a plain-English Error. */
export function parseSong(text: string): Song {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The song data is not valid JSON.");
  }
  if (!isObj(data)) throw new Error("The song data must be an object.");
  if (data.version !== 1) {
    throw new Error(
      `Unsupported song version: ${String(data.version)} (expected 1).`,
    );
  }
  if (data.beatsPerBar !== 4) throw new Error("beatsPerBar must be 4.");
  if (!Array.isArray(data.tracks)) throw new Error("tracks must be a list.");
  return {
    version: 1,
    bpm: finite(data.bpm, "bpm"),
    bars: finite(data.bars, "bars"),
    beatsPerBar: 4,
    tracks: data.tracks.map((t, i) => parseTrack(t, `Track ${i + 1}`)),
  };
}

/** Save the song to storage; failures are logged, never thrown. */
export function saveAutosave(
  storage: Pick<Storage, "setItem">,
  song: Song,
): void {
  try {
    storage.setItem(AUTOSAVE_KEY, serializeSong(song));
  } catch (error) {
    // Autosave is best effort; losing it must not break playing music.
    console.warn("Could not autosave the song:", error);
  }
}

/** Load the autosaved song, or null if missing or unreadable (never throws). */
export function loadAutosave(storage: Pick<Storage, "getItem">): Song | null {
  try {
    const text = storage.getItem(AUTOSAVE_KEY);
    if (text === null) return null;
    return parseSong(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Ignoring the autosave: ${reason}`);
    return null;
  }
}
