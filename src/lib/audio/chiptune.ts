// shortcut: sampled guitars and basses share this chiptune catalogue; split
// it into an instrument catalogue when the instrument picker (#18) lands.
/** Identifier for one of the built-in sounds. */
export type ChiptuneSoundId =
  | "square"
  | "pulse"
  | "pulse12"
  | "saw"
  | "triangle"
  | "pulsebass"
  | "noise"
  | "guitar-acoustic"
  | "guitar-electric"
  | "bass-electric"
  | "bass-upright";

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
    | { kind: "sawtooth" }
    | { kind: "noise" }
    /** Recorded notes in public/samples/<folder>/<note>.mp3, e.g. "As1". */
    | { kind: "sampled"; folder: string; notes: readonly string[] };
  /** Times in seconds; sustain is a level from 0 to 1. */
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  isPolyphonic: boolean;
}

/** The built-in sounds, in display order. */
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
    id: "pulse12",
    name: "Pulse 12.5% (thin lead)",
    colour: "#7986cb",
    wave: { kind: "pulse", width: 0.125 },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.55, release: 0.08 },
    isPolyphonic: true,
  },
  {
    id: "saw",
    name: "Saw lead",
    colour: "#f06292",
    wave: { kind: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.5, release: 0.1 },
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
    id: "pulsebass",
    name: "Pulse bass",
    colour: "#aed581",
    wave: { kind: "pulse", width: 0.5 },
    envelope: { attack: 0.002, decay: 0.15, sustain: 0.35, release: 0.05 },
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
  // Recordings from tonejs-instruments, CC BY 3.0 (see CREDITS.md). Notes in
  // between are pitched from the nearest recording.
  {
    id: "guitar-acoustic",
    name: "Acoustic guitar",
    colour: "#d7a86e",
    wave: {
      kind: "sampled",
      folder: "guitar-acoustic",
      notes: ["E2", "Gs2", "C3", "E3", "Gs3", "C4", "E4", "Gs4", "C5"],
    },
    envelope: { attack: 0, decay: 0, sustain: 1, release: 1 },
    isPolyphonic: true,
  },
  {
    id: "guitar-electric",
    name: "Electric guitar",
    colour: "#e57373",
    wave: {
      kind: "sampled",
      folder: "guitar-electric",
      notes: [
        "Cs2",
        "E2",
        "Fs2",
        "A2",
        "C3",
        "Ds3",
        "Fs3",
        "A3",
        "C4",
        "Ds4",
        "Fs4",
        "A4",
        "C5",
        "Ds5",
        "Fs5",
        "A5",
        "C6",
      ],
    },
    envelope: { attack: 0, decay: 0, sustain: 1, release: 0.6 },
    isPolyphonic: true,
  },
  {
    id: "bass-electric",
    name: "Electric bass",
    colour: "#4db6ac",
    wave: {
      kind: "sampled",
      folder: "bass-electric",
      notes: ["E1", "As1", "E2", "As2", "E3", "As3"],
    },
    envelope: { attack: 0, decay: 0, sustain: 1, release: 0.4 },
    isPolyphonic: true,
  },
  {
    id: "bass-upright",
    name: "Upright bass",
    colour: "#a1887f",
    wave: {
      kind: "sampled",
      folder: "bass-upright",
      notes: ["G1", "As1", "E2", "Gs2", "Cs3", "E3", "Gs3", "B3"],
    },
    envelope: { attack: 0, decay: 0, sustain: 1, release: 0.5 },
    isPolyphonic: true,
  },
];

/** Look up a preset by id; throws if the id is unknown. */
export function getPreset(id: ChiptuneSoundId): ChiptunePreset {
  const preset = CHIPTUNE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown chiptune sound: ${id}`);
  return preset;
}
