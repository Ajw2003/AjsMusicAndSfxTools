/** Identifier for one of the built-in chiptune sounds. */
export type ChiptuneSoundId = "square" | "pulse" | "triangle" | "noise";

/** Plain-data description of a chiptune sound; the engine turns it into a voice. */
export interface ChiptunePreset {
  id: ChiptuneSoundId;
  name: string;
  /** CSS hex colour used for this sound's track and notes. */
  colour: string;
  wave:
    | { kind: "square" }
    | { kind: "pulse"; width: number }
    | { kind: "triangle" }
    | { kind: "noise" };
  /** Times in seconds; sustain is a level from 0 to 1. */
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  isPolyphonic: boolean;
}

/** The four built-in chiptune sounds, in display order. */
export const CHIPTUNE_PRESETS: readonly ChiptunePreset[] = [
  {
    id: "square",
    name: "Square lead",
    colour: "#4fc3f7",
    wave: { kind: "square" },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.08 },
    isPolyphonic: true,
  },
  {
    id: "pulse",
    name: "Pulse 25%",
    colour: "#ba68c8",
    wave: { kind: "pulse", width: 0.25 },
    envelope: { attack: 0.005, decay: 0.12, sustain: 0.5, release: 0.1 },
    isPolyphonic: true,
  },
  {
    id: "triangle",
    name: "Triangle bass",
    colour: "#81c784",
    wave: { kind: "triangle" },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0.9, release: 0.06 },
    // Bass lines are single notes; overlapping ones would muddy the low end.
    isPolyphonic: false,
  },
  {
    id: "noise",
    name: "Noise drums",
    colour: "#ffb74d",
    wave: { kind: "noise" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.03 },
    isPolyphonic: true,
  },
];

/** Look up a preset by id; throws if the id is unknown. */
export function getPreset(id: ChiptuneSoundId): ChiptunePreset {
  const preset = CHIPTUNE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown chiptune sound: ${id}`);
  return preset;
}
