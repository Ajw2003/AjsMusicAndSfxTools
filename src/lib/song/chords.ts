import type { Note } from "./song";

/** Pitch class, 0 = C ... 11 = B. */
export type PitchClass = number;

export type ScaleId = "major" | "minor";

export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "sus2"
  | "sus4"
  | "dominant7"
  | "major7"
  | "minor7";

/** One chord in a progression: what it is and how long it lasts. */
export interface ProgressionChord {
  root: PitchClass;
  quality: ChordQuality;
  beats: number;
}

/** A chord name placed on a clip's source loop (beats from the loop start). */
export interface ChordLabel {
  startBeat: number;
  name: string;
}

// Sharps rather than flats: one spelling keeps names short and predictable.
export const PITCH_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const SCALES: readonly { id: ScaleId; name: string }[] = [
  { id: "major", name: "Major" },
  { id: "minor", name: "Minor" },
];

/** Semitones above the root, and the suffix used in chord names. */
const QUALITIES: Record<
  ChordQuality,
  { name: string; suffix: string; intervals: number[] }
> = {
  major: { name: "Major", suffix: "", intervals: [0, 4, 7] },
  minor: { name: "Minor", suffix: "m", intervals: [0, 3, 7] },
  diminished: { name: "Diminished", suffix: "dim", intervals: [0, 3, 6] },
  augmented: { name: "Augmented", suffix: "aug", intervals: [0, 4, 8] },
  sus2: { name: "Sus2", suffix: "sus2", intervals: [0, 2, 7] },
  sus4: { name: "Sus4", suffix: "sus4", intervals: [0, 5, 7] },
  dominant7: { name: "Seventh (7)", suffix: "7", intervals: [0, 4, 7, 10] },
  major7: { name: "Major 7", suffix: "maj7", intervals: [0, 4, 7, 11] },
  minor7: { name: "Minor 7", suffix: "m7", intervals: [0, 3, 7, 10] },
};

/** Every quality, in menu order, with its display name. */
export const CHORD_QUALITIES = (Object.keys(QUALITIES) as ChordQuality[]).map(
  (id) => ({ id, name: QUALITIES[id].name }),
);

const SCALE_STEPS: Record<ScaleId, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Triad quality built on each scale degree. */
const DEGREE_QUALITIES: Record<ScaleId, ChordQuality[]> = {
  major: ["major", "minor", "minor", "major", "major", "minor", "diminished"],
  minor: ["minor", "diminished", "major", "minor", "minor", "major", "major"],
};

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** "C", "Am", "Bdim", "G7". */
export function chordName(root: PitchClass, quality: ChordQuality): string {
  return PITCH_NAMES[mod12(root)] + QUALITIES[quality].suffix;
}

/** Roman numeral for a degree (0-based): upper case major, lower case minor/dim. */
export function romanNumeral(degree: number, quality: ChordQuality): string {
  const numeral = NUMERALS[degree];
  if (quality === "minor") return numeral.toLowerCase();
  if (quality === "diminished") return `${numeral.toLowerCase()}°`;
  return numeral;
}

export interface SuggestedChord {
  degree: number;
  numeral: string;
  root: PitchClass;
  quality: ChordQuality;
  name: string;
}

/** The seven triads that belong to a key, I to vii. */
export function diatonicChords(
  key: PitchClass,
  scale: ScaleId,
): SuggestedChord[] {
  return SCALE_STEPS[scale].map((step, degree) => {
    const root = mod12(key + step);
    const quality = DEGREE_QUALITIES[scale][degree];
    return {
      degree,
      numeral: romanNumeral(degree, quality),
      root,
      quality,
      name: chordName(root, quality),
    };
  });
}

/** Well-known progressions as scale degrees (0-based), for a quick start. */
export const COMMON_PROGRESSIONS: readonly {
  id: string;
  name: string;
  degrees: number[];
}[] = [
  { id: "pop", name: "I–V–vi–IV (pop)", degrees: [0, 4, 5, 3] },
  { id: "fifties", name: "I–vi–IV–V (50s)", degrees: [0, 5, 3, 4] },
  { id: "jazz", name: "ii–V–I (jazz)", degrees: [1, 4, 0] },
  { id: "sad", name: "vi–IV–I–V", degrees: [5, 3, 0, 4] },
];

/** Lowest note a chord's root can be voiced on (C3). */
const ROOT_FLOOR = 48;

/**
 * MIDI pitches for a chord in root position, root between C3 and B3, so
 * every chord sits in the same comfortable range.
 */
export function chordPitches(
  root: PitchClass,
  quality: ChordQuality,
): number[] {
  const base = ROOT_FLOOR + mod12(root);
  return QUALITIES[quality].intervals.map((i) => base + i);
}

/** Total length of a progression in beats. */
export function progressionBeats(chords: ProgressionChord[]): number {
  return chords.reduce((sum, c) => sum + c.beats, 0);
}

/**
 * The notes and chord labels for a progression played back to back from
 * beat 0. Every note of a chord lasts the chord's whole length.
 */
export function progressionContent(chords: ProgressionChord[]): {
  notes: Note[];
  labels: ChordLabel[];
} {
  const notes: Note[] = [];
  const labels: ChordLabel[] = [];
  let at = 0;
  for (const chord of chords) {
    labels.push({ startBeat: at, name: chordName(chord.root, chord.quality) });
    for (const pitch of chordPitches(chord.root, chord.quality)) {
      notes.push({
        id: crypto.randomUUID(),
        pitch,
        startBeat: at,
        durationBeats: chord.beats,
        velocity: 0.7,
      });
    }
    at += chord.beats;
  }
  return { notes, labels };
}

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}
