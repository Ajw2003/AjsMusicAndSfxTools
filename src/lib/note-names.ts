const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Converts a MIDI note number (0-127) to a note name such as "C4" (60) or "A4" (69). */
export function midiToNoteName(midi: number): string {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError(
      `MIDI note must be an integer from 0 to 127, got ${midi}`,
    );
  }
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
