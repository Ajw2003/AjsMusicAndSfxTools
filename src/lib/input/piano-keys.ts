import type { KeyLayout } from "./key-layouts";

/** One on-screen piano key. */
export interface PianoKey {
  midi: number;
  isBlack: boolean;
}

export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 7;
export const DEFAULT_OCTAVE = 4;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** MIDI number of the C that starts the given octave (octave 4 -> 60). */
export function octaveBaseMidi(octave: number): number {
  return (octave + 1) * 12;
}

/** Keep an octave inside the supported range. */
export function clampOctave(octave: number): number {
  return Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, octave));
}

/** All keys for `octaves` octaves starting at the base C, plus the final C. */
export function pianoKeys(baseMidi: number, octaves = 2): PianoKey[] {
  const keys: PianoKey[] = [];
  for (let i = 0; i <= octaves * 12; i++) {
    const midi = baseMidi + i;
    keys.push({ midi, isBlack: BLACK_PITCH_CLASSES.has(midi % 12) });
  }
  return keys;
}

/** The computer key (KeyboardEvent.code) bound to a midi note, if any. */
export function codeForMidi(
  layout: KeyLayout,
  baseMidi: number,
  midi: number,
): string | undefined {
  const offset = midi - baseMidi;
  return Object.keys(layout.notes).find(
    (code) => layout.notes[code] === offset,
  );
}

/** Midi note for a computer key, or undefined if the key is not a note key. */
export function midiForCode(
  layout: KeyLayout,
  baseMidi: number,
  code: string,
): number | undefined {
  const offset = layout.notes[code];
  if (offset === undefined) return undefined;
  const midi = baseMidi + offset;
  return midi >= 0 && midi <= 127 ? midi : undefined;
}
