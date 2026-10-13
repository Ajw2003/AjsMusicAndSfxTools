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
    /**
     * One recording per semitone from lowMidi to highMidi, in
     * public/samples/<folder>/<note>.mp3 with sharps spelled "s" (As1.mp3).
     * gainDb brings the recordings' median peak to -3 dBFS, like the rest.
     */
    | {
        kind: "sampled";
        folder: string;
        lowMidi: number;
        highMidi: number;
        gainDb: number;
      };
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
  // Plucked recordings from midi-js-soundfonts (see CREDITS.md). A long
  // release lets a note ring on after the key lifts, as a string does.
  {
    id: "guitar-acoustic",
    name: "Acoustic guitar",
    colour: "#d7a86e",
    wave: {
      kind: "sampled",
      folder: "guitar-acoustic",
      lowMidi: 40,
      highMidi: 88,
      gainDb: 15.4,
    },
    envelope: { attack: 0, decay: 0, sustain: 1, release: 2.5 },
    isPolyphonic: true,
  },
  {
    id: "guitar-electric",
    name: "Electric guitar (clean)",
    colour: "#e57373",
    wave: {
      kind: "sampled",
      folder: "guitar-electric",
      lowMidi: 40,
      highMidi: 88,
      gainDb: 20.1,
    },
    envelope: { attack: 0, decay: 0, sustain: 1, release: 2 },
    isPolyphonic: true,
  },
  {
    id: "bass-electric",
    name: "Electric bass (picked)",
    colour: "#4db6ac",
    wave: {
      kind: "sampled",
      folder: "bass-electric",
      lowMidi: 28,
      highMidi: 67,
      gainDb: 15.3,
    },
    envelope: { attack: 0, decay: 0, sustain: 1, release: 1.5 },
    isPolyphonic: true,
  },
  {
    id: "bass-upright",
    name: "Upright bass (plucked)",
    colour: "#a1887f",
    wave: {
      kind: "sampled",
      folder: "bass-upright",
      lowMidi: 28,
      highMidi: 67,
      gainDb: 15.2,
    },
    envelope: { attack: 0, decay: 0, sustain: 1, release: 1.5 },
    isPolyphonic: true,
  },
];

/** Look up a preset by id; throws if the id is unknown. */
export function getPreset(id: ChiptuneSoundId): ChiptunePreset {
  const preset = CHIPTUNE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown chiptune sound: ${id}`);
  return preset;
}

/** Sample file name for a note name: sharps are spelled "s" ("A#1" -> "As1"). */
export function sampleFileName(noteName: string): string {
  return noteName.replace("#", "s");
}
