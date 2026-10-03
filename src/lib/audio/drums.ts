export type DrumKind = "kick" | "snare" | "hat";

/** Pitch picks the drum: low = kick, middle = snare, high = hat. */
export function drumKind(midi: number): DrumKind {
  if (midi < 60) return "kick";
  if (midi < 72) return "snare";
  return "hat";
}

const DRUM_LABELS: Record<DrumKind, string> = {
  kick: "Kick",
  snare: "Snare",
  hat: "Hat",
};

/** Name shown on an on-screen key when a noise-drum track is selected. */
export function drumLabel(midi: number): string {
  return DRUM_LABELS[drumKind(midi)];
}
