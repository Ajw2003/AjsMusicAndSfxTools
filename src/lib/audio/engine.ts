// The ONLY file in the app that imports Tone.js.
import * as Tone from "tone";
import { getPreset, type ChiptunePreset } from "./chiptune";
import { drumKind } from "./drums";
import { encodeWav } from "./wav";
import {
  expandClipNotes,
  songEndBeat,
  type Note,
  type Song,
  type Track,
} from "../song/song";

/** Ticks per quarter note used for all transport scheduling (bpm-independent). */
const PPQ = 192;
const TAIL_SECONDS = 1;

/** Velocity after a clip's gain in dB (0 dB leaves it unchanged), kept in 0..1. */
function withGain(velocity: number, gainDb: number): number {
  return Math.min(1, Math.max(0, velocity * Math.pow(10, gainDb / 20)));
}

/** Notes of every clip on a track that start in [from, to), with clip gain applied. */
function scheduledNotes(track: Track, from: number, to: number): Note[] {
  const out: Note[] = [];
  for (const clip of track.clips) {
    for (const n of expandClipNotes(clip)) {
      if (n.startBeat >= from && n.startBeat < to) {
        out.push({ ...n, velocity: withGain(n.velocity, clip.gainDb) });
      }
    }
  }
  return out;
}

const toHz = (midi: number): number =>
  Tone.Frequency(midi, "midi").toFrequency();

/** One instrument, hiding the differences between synth kinds. */
interface Voice {
  /** Audio output (already includes this voice's volume). */
  readonly output: Tone.Volume;
  attack(midi: number, velocity: number, time?: number): void;
  release(midi: number, time?: number): void;
  /** Play a note of known length at a scheduled time (seconds). */
  play(midi: number, seconds: number, velocity: number, time: number): void;
  releaseAll(): void;
  dispose(): void;
}

function buildNoiseVoice(preset: ChiptunePreset): Voice {
  const output = new Tone.Volume(0);
  const env = preset.envelope;
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 },
  }).connect(output);
  // Kick = low sine thump layered with a lowpassed noise click.
  const kickNoiseFilter = new Tone.Filter(250, "lowpass").connect(output);
  const kickNoise = new Tone.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.03 },
  }).connect(kickNoiseFilter);
  const snareFilter = new Tone.Filter(1800, "bandpass", -12).connect(output);
  snareFilter.Q.value = 0.8;
  const snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { ...env, decay: 0.14 },
  }).connect(snareFilter);
  const hatFilter = new Tone.Filter(7000, "highpass").connect(output);
  const hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
  }).connect(hatFilter);

  const all = [
    kick,
    kickNoise,
    kickNoiseFilter,
    snare,
    snareFilter,
    hat,
    hatFilter,
  ];
  return {
    output,
    attack(midi, velocity, time) {
      switch (drumKind(midi)) {
        case "kick":
          kick.triggerAttack(toHz(Math.min(midi, 40)), time, velocity);
          kickNoise.triggerAttack(time, velocity * 0.5);
          break;
        case "snare":
          snare.triggerAttack(time, velocity);
          break;
        case "hat":
          hat.triggerAttack(time, velocity);
          break;
      }
    },
    release(midi, time) {
      // Drum envelopes have zero sustain, so they decay on their own;
      // releasing just cuts a still-held tail short.
      switch (drumKind(midi)) {
        case "kick":
          kickNoise.triggerRelease(time);
          break;
        case "snare":
          snare.triggerRelease(time);
          break;
        case "hat":
          hat.triggerRelease(time);
          break;
      }
    },
    play(midi, seconds, velocity, time) {
      this.attack(midi, velocity, time);
      this.release(midi, time + Math.min(seconds, 0.05));
    },
    releaseAll() {
      kickNoise.triggerRelease();
      snare.triggerRelease();
      hat.triggerRelease();
    },
    dispose() {
      for (const n of all) n.dispose();
      output.dispose();
    },
  };
}

function buildPitchedVoice(preset: ChiptunePreset): Voice {
  const output = new Tone.Volume(0);
  const wave = preset.wave;
  const oscillator =
    wave.kind === "pulse"
      ? { type: "pulse", width: wave.width }
      : { type: wave.kind === "triangle" ? "triangle" : "square" };
  const options = {
    oscillator,
    envelope: preset.envelope,
  } as Partial<Tone.SynthOptions>;

  if (preset.isPolyphonic) {
    const synth = new Tone.PolySynth(Tone.Synth, options).connect(output);
    return {
      output,
      attack: (midi, velocity, time) =>
        synth.triggerAttack(toHz(midi), time, velocity),
      release: (midi, time) => synth.triggerRelease(toHz(midi), time),
      play: (midi, seconds, velocity, time) =>
        synth.triggerAttackRelease(toHz(midi), seconds, time, velocity),
      releaseAll: () => synth.releaseAll(),
      dispose() {
        synth.dispose();
        output.dispose();
      },
    };
  }

  const synth = new Tone.Synth(options).connect(output);
  let heldMidi: number | null = null;
  return {
    output,
    attack(midi, velocity, time) {
      heldMidi = midi;
      synth.triggerAttack(toHz(midi), time, velocity);
    },
    release(midi, time) {
      // Only release if this is still the sounding note (monophonic legato).
      if (heldMidi === midi) {
        heldMidi = null;
        synth.triggerRelease(time);
      }
    },
    play: (midi, seconds, velocity, time) =>
      synth.triggerAttackRelease(toHz(midi), seconds, time, velocity),
    releaseAll() {
      heldMidi = null;
      synth.triggerRelease();
    },
    dispose() {
      synth.dispose();
      output.dispose();
    },
  };
}

function buildVoice(preset: ChiptunePreset): Voice {
  return preset.wave.kind === "noise"
    ? buildNoiseVoice(preset)
    : buildPitchedVoice(preset);
}

/** Volume -> Limiter(-1 dB) -> Destination, built in the current context. */
function buildMaster(db: number): { volume: Tone.Volume; dispose(): void } {
  const volume = new Tone.Volume(db);
  const limiter = new Tone.Limiter(-1);
  volume.connect(limiter);
  limiter.toDestination();
  return {
    volume,
    dispose() {
      volume.dispose();
      limiter.dispose();
    },
  };
}

interface TrackVoice {
  sound: Track["sound"];
  voice: Voice;
}

/** Owns all sound. Everything else in the app talks to this, never to Tone. */
export class AudioEngine {
  #started = false;
  #starting: Promise<void> | null = null;
  #master: ReturnType<typeof buildMaster> | null = null;
  #masterDb = 0;
  #voices = new Map<string, TrackVoice>();
  #parts: Tone.Part[] = [];
  #loopBeats = 16;
  /** Timeline beat where the loop (or the song) starts. */
  #loopStart = 0;
  #isLooping = true;
  #metronomeOn = false;
  #metronomeId: number | null = null;
  #click: Tone.Synth | null = null;
  /** Audio time at which a pending count-in ends (0 = none). */
  #countInEnd = 0;
  #beatsPerBar = 4;

  get isStarted(): boolean {
    return this.#started;
  }

  /** Resume audio. Browsers only allow this from a user gesture. Idempotent. */
  async start(): Promise<void> {
    if (this.#started) return;
    this.#starting ??= (async () => {
      await Tone.start();
      // Tone's default lookAhead (0.1 s) schedules live notes that far ahead,
      // which feels laggy when playing by hand. 20 ms is still enough to keep
      // timing stable while keeping live latency low.
      Tone.getContext().lookAhead = 0.02;
      this.#started = true;
    })().finally(() => {
      this.#starting = null;
    });
    await this.#starting;
  }

  #ensureMaster(): ReturnType<typeof buildMaster> {
    this.#master ??= buildMaster(this.#masterDb);
    return this.#master;
  }

  setMasterVolumeDb(db: number): void {
    this.#masterDb = db;
    if (this.#master) this.#master.volume.volume.value = db;
  }

  /** Create, replace or dispose voices so each track has one matching its sound. */
  syncTracks(tracks: Track[]): void {
    const master = this.#ensureMaster();
    const wanted = new Set(tracks.map((t) => t.id));
    for (const [id, tv] of this.#voices) {
      if (!wanted.has(id)) {
        tv.voice.dispose();
        this.#voices.delete(id);
      }
    }
    for (const track of tracks) {
      let tv = this.#voices.get(track.id);
      if (tv && tv.sound !== track.sound) {
        tv.voice.dispose();
        tv = undefined;
      }
      if (!tv) {
        const voice = buildVoice(getPreset(track.sound));
        voice.output.connect(master.volume);
        tv = { sound: track.sound, voice };
        this.#voices.set(track.id, tv);
      }
      // Mute is NOT applied to the voice: live play always ignores mute, and
      // playback mutes by not scheduling the track's notes (see setSong).
      tv.voice.output.volume.value = track.volumeDb;
    }
  }

  #voiceFor(trackId: string): Voice {
    const tv = this.#voices.get(trackId);
    if (!tv) {
      throw new Error(
        `No voice for track "${trackId}"; call engine.syncTracks() first.`,
      );
    }
    return tv.voice;
  }

  noteOn(trackId: string, midi: number, velocity = 0.8): void {
    this.#voiceFor(trackId).attack(midi, velocity);
  }

  noteOff(trackId: string, midi: number): void {
    this.#voiceFor(trackId).release(midi);
  }

  releaseAll(): void {
    for (const tv of this.#voices.values()) tv.voice.releaseAll();
  }

  // ---- Transport ----

  #clearSchedules(): void {
    for (const p of this.#parts) p.dispose();
    this.#parts = [];
  }

  /**
   * Set tempo and loop, and (re)schedule every unmuted notes track. With a
   * loop region the transport loops over it; without one the song plays from
   * the start to its end and stops.
   */
  setSong(song: Song): void {
    const transport = Tone.getTransport();
    transport.PPQ = PPQ;
    transport.bpm.value = song.bpm;
    this.#beatsPerBar = song.beatsPerBar;
    const region = song.loopRegion;
    const from = region ? region.startBeat : 0;
    const to = region ? region.endBeat : songEndBeat(song);
    this.#loopStart = from;
    this.#loopBeats = to - from;
    this.#isLooping = region !== null;
    transport.loop = this.#isLooping;
    transport.loopStart = `${Math.round(from * PPQ)}i`;
    transport.loopEnd = `${Math.round(to * PPQ)}i`;

    this.#clearSchedules();
    const secondsPerBeat = 60 / song.bpm;
    for (const track of song.tracks) {
      if (track.isMuted || track.kind !== "notes") continue;
      const notes = scheduledNotes(track, from, to);
      if (notes.length === 0) continue;
      const voice = this.#voiceFor(track.id);
      // Events are placed in ticks so a tempo change never moves them. The
      // transport itself loops, so the Part does not loop on its own (doing
      // both would trigger every note twice).
      const part = new Tone.Part<{
        time: string;
        midi: number;
        seconds: number;
        velocity: number;
      }>(
        (time, ev) => voice.play(ev.midi, ev.seconds, ev.velocity, time),
        notes.map((n) => ({
          time: `${Math.round(n.startBeat * PPQ)}i`,
          midi: n.pitch,
          seconds: n.durationBeats * secondsPerBeat,
          velocity: n.velocity,
        })),
      );
      part.start(0);
      this.#parts.push(part);
    }
    this.#scheduleMetronome();
  }

  #clickSynth(): Tone.Synth {
    this.#click ??= new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
      volume: -12,
    }).connect(this.#ensureMaster().volume);
    return this.#click;
  }

  #scheduleMetronome(): void {
    const transport = Tone.getTransport();
    if (this.#metronomeId !== null) {
      transport.clear(this.#metronomeId);
      this.#metronomeId = null;
    }
    if (!this.#metronomeOn) return;
    const click = this.#clickSynth();
    this.#metronomeId = transport.scheduleRepeat((time) => {
      const beat = Math.round(transport.getTicksAtTime(time) / PPQ);
      const isDownbeat = beat % this.#beatsPerBar === 0;
      click.triggerAttackRelease(isDownbeat ? 1568 : 1046, 0.03, time);
    }, `${PPQ}i`);
  }

  /** A short click on every beat while playing; higher on beat 1. */
  setMetronome(isOn: boolean): void {
    this.#metronomeOn = isOn;
    this.#scheduleMetronome();
  }

  play(): void {
    Tone.getTransport().start();
  }

  /**
   * Play `beats` metronome clicks (even if the metronome is off), then start
   * the transport from the loop start at the exact end of the last click.
   * Both are placed on the audio clock, so the timing is sample-accurate.
   */
  playWithCountIn(beats = 4): void {
    const spb = 60 / Tone.getTransport().bpm.value;
    const click = this.#clickSynth();
    const t0 = Tone.now() + 0.05;
    for (let i = 0; i < beats; i++) {
      click.triggerAttackRelease(
        i % this.#beatsPerBar === 0 ? 1568 : 1046,
        0.03,
        t0 + i * spb,
      );
    }
    this.#countInEnd = t0 + beats * spb;
    Tone.getTransport().start(this.#countInEnd);
  }

  /** True between playWithCountIn() and the moment the loop starts. */
  get isCountingIn(): boolean {
    return this.#countInEnd > 0 && Tone.now() < this.#countInEnd;
  }

  stop(): void {
    const transport = Tone.getTransport();
    this.#countInEnd = 0;
    transport.stop();
    transport.position = 0;
    this.releaseAll();
  }

  get isPlaying(): boolean {
    return Tone.getTransport().state === "started";
  }

  /** Position on the timeline, in beats (float). */
  currentBeat(): number {
    const beats = Tone.getTransport().ticks / PPQ;
    if (!this.#isLooping) return beats;
    return this.#loopStart + ((beats - this.#loopStart) % this.#loopBeats);
  }

  /**
   * Render `loops` passes of the loop region (or the whole song when there
   * is none) plus a 1 s tail to WAV bytes.
   * Tone.Offline runs in its OWN AudioContext, so the live voices (which
   * belong to the real context) cannot be used: fresh voices and a fresh
   * master chain are built inside the offline callback. Notes are placed at
   * absolute times, so the offline transport is not needed.
   */
  async renderWav(song: Song, loops: number): Promise<Uint8Array> {
    const region = song.loopRegion;
    const from = region ? region.startBeat : 0;
    const to = region ? region.endBeat : songEndBeat(song);
    const passes = region ? loops : 1;
    const beats = to - from;
    const secondsPerBeat = 60 / song.bpm;
    const duration = beats * secondsPerBeat * passes + TAIL_SECONDS;
    const buffer = await Tone.Offline(() => {
      const master = buildMaster(this.#masterDb);
      for (const track of song.tracks) {
        if (track.isMuted || track.kind !== "notes") continue;
        const notes = scheduledNotes(track, from, to);
        const voice = buildVoice(getPreset(track.sound));
        voice.output.volume.value = track.volumeDb;
        voice.output.connect(master.volume);
        for (let pass = 0; pass < passes; pass++) {
          for (const n of notes) {
            const time = (pass * beats + n.startBeat - from) * secondsPerBeat;
            voice.play(
              n.pitch,
              n.durationBeats * secondsPerBeat,
              n.velocity,
              time,
            );
          }
        }
      }
    }, duration);
    const channels: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }
    return encodeWav(channels, buffer.sampleRate);
  }
}

export const engine = new AudioEngine();
