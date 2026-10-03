import { CHIPTUNE_PRESETS } from "../audio/chiptune";
import type {
  ChordPad,
  Clip,
  ClipContent,
  LoopRegion,
  Note,
  Song,
  Track,
} from "./song";

const AUTOSAVE_KEY = "ajs-music.autosave.v2";
const AUTOSAVE_KEY_V1 = "ajs-music.autosave.v1";

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

function pickSound(v: Obj, where: string): Track["sound"] {
  const preset = CHIPTUNE_PRESETS.find((p) => p.id === v.sound);
  if (!preset) {
    throw new Error(`${where} has an unknown sound "${String(v.sound)}".`);
  }
  return preset.id;
}

function parseTrackV1(v: unknown, where: string, loopBeats: number): Track {
  if (!isObj(v)) throw new Error(`${where} must be an object.`);
  const sound = pickSound(v, where);
  if (typeof v.isMuted !== "boolean") {
    throw new Error(`${where} isMuted must be true or false.`);
  }
  if (!Array.isArray(v.notes))
    throw new Error(`${where} notes must be a list.`);
  const name = str(v.name, `${where} name`);
  const notes = v.notes.map((n, i) => parseNote(n, `${where} note ${i + 1}`));
  return {
    id: str(v.id, `${where} id`),
    name,
    kind: "notes",
    sound,
    volumeDb: finite(v.volumeDb, `${where} volumeDb`),
    isMuted: v.isMuted,
    clips: [
      {
        id: crypto.randomUUID(),
        name,
        startBeat: 0,
        lengthBeats: loopBeats,
        loopBeats,
        offsetBeats: 0,
        transpose: 0,
        gainDb: 0,
        colour: null,
        content: { kind: "notes", notes },
      },
    ],
  };
}

function parseContent(v: unknown, where: string): ClipContent {
  if (!isObj(v)) throw new Error(`${where} content must be an object.`);
  if (v.kind === "notes") {
    if (!Array.isArray(v.notes)) {
      throw new Error(`${where} notes must be a list.`);
    }
    return {
      kind: "notes",
      notes: v.notes.map((n, i) => parseNote(n, `${where} note ${i + 1}`)),
    };
  }
  if (v.kind === "audio") {
    return {
      kind: "audio",
      assetId: str(v.assetId, `${where} assetId`),
      sourceOffsetSeconds: finite(
        v.sourceOffsetSeconds,
        `${where} sourceOffsetSeconds`,
      ),
    };
  }
  throw new Error(`${where} content kind must be "notes" or "audio".`);
}

function inRange(n: number, min: number, max: number, what: string): number {
  if (n < min || n > max) {
    throw new Error(`${what} must be between ${min} and ${max}.`);
  }
  return n;
}

function parseClip(v: unknown, where: string): Clip {
  if (!isObj(v)) throw new Error(`${where} must be an object.`);
  const startBeat = finite(v.startBeat, `${where} startBeat`);
  if (startBeat < 0) throw new Error(`${where} startBeat must be 0 or more.`);
  const lengthBeats = finite(v.lengthBeats, `${where} lengthBeats`);
  if (lengthBeats <= 0)
    throw new Error(`${where} lengthBeats must be above 0.`);
  const loopBeats = finite(v.loopBeats, `${where} loopBeats`);
  if (loopBeats <= 0) throw new Error(`${where} loopBeats must be above 0.`);
  const offsetBeats = finite(v.offsetBeats, `${where} offsetBeats`);
  if (offsetBeats < 0 || offsetBeats >= loopBeats) {
    throw new Error(
      `${where} offsetBeats must be 0 or more and below loopBeats.`,
    );
  }
  if (v.colour !== null && typeof v.colour !== "string") {
    throw new Error(`${where} colour must be text or null.`);
  }
  return {
    id: str(v.id, `${where} id`),
    name: str(v.name, `${where} name`),
    startBeat,
    lengthBeats,
    loopBeats,
    offsetBeats,
    transpose: inRange(
      finite(v.transpose, `${where} transpose`),
      -24,
      24,
      `${where} transpose`,
    ),
    gainDb: inRange(
      finite(v.gainDb, `${where} gainDb`),
      -30,
      6,
      `${where} gainDb`,
    ),
    colour: v.colour,
    content: parseContent(v.content, where),
  };
}

function parseTrackV2(v: unknown, where: string): Track {
  if (!isObj(v)) throw new Error(`${where} must be an object.`);
  const sound = pickSound(v, where);
  if (typeof v.isMuted !== "boolean") {
    throw new Error(`${where} isMuted must be true or false.`);
  }
  if (v.kind !== "notes" && v.kind !== "audio") {
    throw new Error(`${where} kind must be "notes" or "audio".`);
  }
  if (!Array.isArray(v.clips))
    throw new Error(`${where} clips must be a list.`);
  return {
    id: str(v.id, `${where} id`),
    name: str(v.name, `${where} name`),
    kind: v.kind,
    sound,
    volumeDb: finite(v.volumeDb, `${where} volumeDb`),
    isMuted: v.isMuted,
    clips: v.clips.map((c, i) => parseClip(c, `${where} clip ${i + 1}`)),
  };
}

function parseLoopRegion(v: unknown): LoopRegion | null {
  if (v === null) return null;
  if (!isObj(v)) throw new Error("loopRegion must be an object or null.");
  const startBeat = finite(v.startBeat, "loopRegion startBeat");
  const endBeat = finite(v.endBeat, "loopRegion endBeat");
  if (startBeat < 0 || endBeat <= startBeat) {
    throw new Error(
      "loopRegion must start at 0 or later and end after it starts.",
    );
  }
  return { startBeat, endBeat };
}

function parseChordPad(v: unknown, where: string): ChordPad {
  if (!isObj(v)) throw new Error(`${where} must be an object.`);
  if (!Array.isArray(v.pitches)) {
    throw new Error(`${where} pitches must be a list.`);
  }
  if (v.keyCode !== null && typeof v.keyCode !== "string") {
    throw new Error(`${where} keyCode must be text or null.`);
  }
  return {
    id: str(v.id, `${where} id`),
    name: str(v.name, `${where} name`),
    pitches: v.pitches.map((p, i) => finite(p, `${where} pitch ${i + 1}`)),
    keyCode: v.keyCode,
  };
}

/** Parse and strictly validate song JSON (version 1 or 2); throws a plain-English Error. */
export function parseSong(text: string): Song {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The song data is not valid JSON.");
  }
  if (!isObj(data)) throw new Error("The song data must be an object.");
  if (data.version !== 1 && data.version !== 2) {
    throw new Error(
      `Unsupported song version: ${String(data.version)} (expected 1 or 2).`,
    );
  }
  if (data.beatsPerBar !== 4) throw new Error("beatsPerBar must be 4.");
  if (!Array.isArray(data.tracks)) throw new Error("tracks must be a list.");
  const bpm = finite(data.bpm, "bpm");
  if (data.version === 1) {
    const bars = finite(data.bars, "bars");
    if (bars <= 0) throw new Error("bars must be above 0.");
    const length = bars * 4;
    return {
      version: 2,
      bpm,
      beatsPerBar: 4,
      tracks: data.tracks.map((t, i) =>
        parseTrackV1(t, `Track ${i + 1}`, length),
      ),
      loopRegion: { startBeat: 0, endBeat: length },
      chordPads: [],
    };
  }
  if (!Array.isArray(data.chordPads)) {
    throw new Error("chordPads must be a list.");
  }
  return {
    version: 2,
    bpm,
    beatsPerBar: 4,
    tracks: data.tracks.map((t, i) => parseTrackV2(t, `Track ${i + 1}`)),
    loopRegion: parseLoopRegion(data.loopRegion),
    chordPads: data.chordPads.map((p, i) =>
      parseChordPad(p, `Chord pad ${i + 1}`),
    ),
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
    // Prefer the current key; fall back to (and upgrade) an older v1 save.
    const text =
      storage.getItem(AUTOSAVE_KEY) ?? storage.getItem(AUTOSAVE_KEY_V1);
    if (text === null) return null;
    return parseSong(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Ignoring the autosave: ${reason}`);
    return null;
  }
}
