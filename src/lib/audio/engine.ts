// The ONLY file in the app that imports Tone.js.
import * as Tone from "tone";
import { getPreset, type ChiptunePreset } from "./chiptune";
import { countInNumber } from "../song/count-in";
import { drumKind } from "./drums";
import { encodeWav } from "./wav";
import {
  expandClipNotes,
  songEndBeat,
  type LoopRegion,
  type Note,
  type Song,
  type Track,
} from "../song/song";

/** Ticks per quarter note used for all transport scheduling (bpm-independent). */
const PPQ = 192;
const TAIL_SECONDS = 1;
/** Notes one polyphonic track can sound at once, release tails included. */
const MAX_VOICES = 32;
/** Notes held by hand at once; one more lets go of the oldest (#98). */
const MAX_HELD_NOTES = 10;

/** Velocity after a clip's gain in dB (0 dB leaves it unchanged), kept in 0..1. */
function withGain(velocity: number, gainDb: number): number {
  return Math.min(1, Math.max(0, velocity * Math.pow(10, gainDb / 20)));
}

/** Notes of every clip on a track that start in [from, to), with clip gain applied, by start. */
function scheduledNotes(track: Track, from: number, to: number): Note[] {
  const out: Note[] = [];
  for (const clip of track.clips) {
    for (const n of expandClipNotes(clip)) {
      if (n.startBeat >= from && n.startBeat < to) {
        out.push({ ...n, velocity: withGain(n.velocity, clip.gainDb) });
      }
    }
  }
  // In time order, so the voice pool hands out voices as the notes come.
  return out.sort((a, b) => a.startBeat - b.startBeat);
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
  /** Cut every sounding note at `time` (default: now). */
  releaseAll(time?: number): void;
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
    releaseAll(time) {
      kickNoise.triggerRelease(time);
      snare.triggerRelease(time);
      hat.triggerRelease(time);
    },
    dispose() {
      for (const n of all) n.dispose();
      output.dispose();
    },
  };
}

interface PoolVoice {
  synth: Tone.Synth;
  /** Pitch held by hand on this voice, or null. */
  heldMidi: number | null;
  /** Audio time when its last note has fully died away. */
  freeAt: number;
  /** Audio time its last note started, to find the oldest. */
  startedAt: number;
}

/**
 * A fixed set of mono synths shared by one track's notes. Tone's PolySynth
 * only takes back finished voices on a once-a-second timer, so a fast burst
 * of notes ran out of voices and the new notes were dropped (#98). Here a
 * voice is free again the moment its release ends, and when every voice is
 * busy the oldest note is taken over, so a played note is never dropped.
 */
function buildVoicePool(
  options: Partial<Tone.SynthOptions>,
  preset: ChiptunePreset,
  output: Tone.Volume,
): Voice {
  const voices: PoolVoice[] = [];
  // Small margin so a reused voice has finished its release curve.
  const releaseSeconds = preset.envelope.release * 1.5 + 0.01;

  function take(time: number): PoolVoice {
    const idle = voices.find((v) => v.heldMidi === null && v.freeAt <= time);
    if (idle) return idle;
    if (voices.length < MAX_VOICES) {
      const v: PoolVoice = {
        synth: new Tone.Synth(options).connect(output),
        heldMidi: null,
        freeAt: 0,
        startedAt: 0,
      };
      voices.push(v);
      return v;
    }
    // All busy: prefer a fading note over a held one, then the oldest.
    const byAge = [...voices].sort(
      (a, b) =>
        Number(a.heldMidi !== null) - Number(b.heldMidi !== null) ||
        a.startedAt - b.startedAt,
    );
    return byAge[0];
  }

  const heldVoices = () => voices.filter((v) => v.heldMidi !== null);

  function releaseVoice(v: PoolVoice, time: number): void {
    v.heldMidi = null;
    v.freeAt = time + releaseSeconds;
    v.synth.triggerRelease(time);
  }

  return {
    output,
    attack(midi, velocity, time = Tone.immediate()) {
      // A note already held (a chord pad and a key sharing a pitch)
      // replaces its earlier copy rather than stacking a second one.
      const same = voices.find((v) => v.heldMidi === midi);
      if (same) releaseVoice(same, time);
      const held = heldVoices();
      if (held.length >= MAX_HELD_NOTES) {
        const oldest = held.reduce((a, b) =>
          a.startedAt <= b.startedAt ? a : b,
        );
        releaseVoice(oldest, time);
      }
      const v = take(time);
      v.heldMidi = midi;
      v.startedAt = time;
      v.freeAt = Infinity;
      v.synth.triggerAttack(toHz(midi), time, velocity);
    },
    release(midi, time = Tone.immediate()) {
      const v = voices.find((x) => x.heldMidi === midi);
      if (v) releaseVoice(v, time);
    },
    play(midi, seconds, velocity, time) {
      const v = take(time);
      v.heldMidi = null;
      v.startedAt = time;
      v.freeAt = time + seconds + releaseSeconds;
      v.synth.triggerAttackRelease(toHz(midi), seconds, time, velocity);
    },
    releaseAll(time = Tone.immediate()) {
      for (const v of voices) {
        if (v.heldMidi !== null || v.freeAt > time) releaseVoice(v, time);
      }
    },
    dispose() {
      for (const v of voices) v.synth.dispose();
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

  if (preset.isPolyphonic) return buildVoicePool(options, preset, output);

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
    releaseAll(time) {
      heldMidi = null;
      synth.triggerRelease(time);
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
  /** Loop region from the song. */
  #region: LoopRegion | null = null;
  /** While recording: no loop and no stop at the song end. */
  #isFreeRun = false;
  #loopEnabled = false;
  /** Where the song ends (playback stops here when not looping). */
  #endBeat = 16;
  #endEventId: number | null = null;
  #metronomeOn = false;
  #metronomeId: number | null = null;
  #click: Tone.Synth | null = null;
  /** Audio time at which a pending count-in ends (0 = none). */
  #countInEnd = 0;
  #countInStart = 0;
  #countInBeats = 0;
  #countInSpb = 0;
  #beatsPerBar = 4;

  get isStarted(): boolean {
    return this.#started;
  }

  /** Resume audio. Browsers only allow this from a user gesture. Idempotent. */
  async start(): Promise<void> {
    if (this.#started) return;
    this.#starting ??= (async () => {
      await Tone.start();
      // Tone's default look-ahead (0.1 s) is kept for song playback: notes
      // are scheduled that far ahead, so a busy main thread can't make them
      // late. Live notes bypass it (see noteOn). A 20 ms look-ahead made
      // chords land late under load.
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

  // Live notes and releases happen at the audio clock's present moment,
  // not Tone's now() (which adds the scheduling look-ahead), so playing by
  // hand has no added latency.

  noteOn(trackId: string, midi: number, velocity = 0.8): void {
    this.#voiceFor(trackId).attack(midi, velocity, Tone.immediate());
  }

  noteOff(trackId: string, midi: number): void {
    this.#voiceFor(trackId).release(midi, Tone.immediate());
  }

  releaseAll(): void {
    const time = Tone.immediate();
    for (const tv of this.#voices.values()) tv.voice.releaseAll(time);
  }

  // ---- Transport ----

  #clearSchedules(): void {
    for (const p of this.#parts) p.dispose();
    this.#parts = [];
  }

  /** The loop region in effect, or null when playback runs linearly. */
  get activeLoop(): LoopRegion | null {
    if (this.#isFreeRun) return null;
    return this.#loopEnabled ? this.#region : null;
  }

  /** Beat where linear playback stops by itself. */
  get endBeat(): number {
    return this.#endBeat;
  }

  #applyLoop(): void {
    const transport = Tone.getTransport();
    const loop = this.activeLoop;
    transport.loop = loop !== null;
    if (loop) {
      transport.loopStart = `${Math.round(loop.startBeat * PPQ)}i`;
      transport.loopEnd = `${Math.round(loop.endBeat * PPQ)}i`;
      // A playhead outside the region would never reach its end.
      const b = this.currentBeat();
      if (b < loop.startBeat || b >= loop.endBeat) this.seek(loop.startBeat);
    }
  }

  /** Turn looping over the song's loop region on or off. */
  setLoopEnabled(isOn: boolean): void {
    this.#loopEnabled = isOn;
    this.#applyLoop();
  }

  /**
   * Free run (used while recording): ignore the loop region and play on
   * past the song end until told to stop. Turning it off past the end
   * stops playback there, as the end event has already gone by.
   */
  setFreeRun(isOn: boolean): void {
    this.#isFreeRun = isOn;
    this.#applyLoop();
    if (
      !isOn &&
      this.isPlaying &&
      !this.activeLoop &&
      this.currentBeat() >= this.#endBeat - 1e-6
    ) {
      this.pause();
    }
  }

  /**
   * Set tempo and loop region, and (re)schedule every unmuted notes track
   * over the whole timeline. With looping on, the transport loops the
   * region; otherwise it plays on and stops by itself at the song end.
   */
  setSong(song: Song): void {
    const transport = Tone.getTransport();
    transport.PPQ = PPQ;
    transport.bpm.value = song.bpm;
    this.#beatsPerBar = song.beatsPerBar;
    this.#region = song.loopRegion ? { ...song.loopRegion } : null;
    this.#endBeat = songEndBeat(song);
    this.#applyLoop();

    this.#clearSchedules();
    const secondsPerBeat = 60 / song.bpm;
    for (const track of song.tracks) {
      if (track.isMuted || track.kind !== "notes") continue;
      const notes = scheduledNotes(track, 0, Infinity);
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
    this.#scheduleEnd();
    this.#scheduleMetronome();
  }

  #scheduleEnd(): void {
    const transport = Tone.getTransport();
    if (this.#endEventId !== null) transport.clear(this.#endEventId);
    this.#endEventId = transport.schedule(
      (time) => {
        if (this.activeLoop || this.#isFreeRun) return;
        // Stop on the main thread at the moment the end is heard, leaving
        // the playhead at the end; play() rewinds from there. Rewinding to 0
        // here raced Tone's clock, which could replay beat 0's notes.
        Tone.getDraw().schedule(() => {
          if (!this.activeLoop && !this.#isFreeRun && this.isPlaying) {
            this.pause();
          }
        }, time);
      },
      `${Math.round(this.#endBeat * PPQ)}i`,
    );
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

  /** Start from the playhead (from the start if it is at or past the song end). */
  play(): void {
    this.#prepareStart();
    Tone.getTransport().start();
  }

  #prepareStart(): void {
    if (
      !this.activeLoop &&
      !this.#isFreeRun &&
      this.currentBeat() >= this.#endBeat - 1e-6
    ) {
      this.seek(0);
    }
  }

  /**
   * Play `beats` metronome clicks (even if the metronome is off), then start
   * the transport from the playhead at the exact end of the last click.
   * Both are placed on the audio clock, so the timing is sample-accurate.
   */
  playWithCountIn(beats = 4): void {
    this.#prepareStart();
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
    this.#countInStart = t0;
    this.#countInBeats = beats;
    this.#countInSpb = spb;
    Tone.getTransport().start(this.#countInEnd);
  }

  /** True between playWithCountIn() and the moment playback starts. */
  get isCountingIn(): boolean {
    return this.#countInEnd > 0 && Tone.now() < this.#countInEnd;
  }

  /** The number to show now (4, 3, 2, 1), from the audio clock; null if none. */
  get countInNumber(): number | null {
    if (this.#countInEnd === 0) return null;
    return countInNumber(
      Tone.now(),
      this.#countInStart,
      this.#countInSpb,
      this.#countInBeats,
    );
  }

  /** Stop (cancelling any count-in) and leave the playhead at `beat`. */
  #stopAt(beat: number): void {
    const transport = Tone.getTransport();
    this.#countInEnd = 0;
    transport.stop();
    transport.ticks = Math.round(Math.max(0, beat) * PPQ);
    this.releaseAll();
  }

  /** Stop and keep the playhead where it is. */
  pause(): void {
    this.#stopAt(this.currentBeat());
  }

  /** Stop and return the playhead to the start. */
  stop(): void {
    this.#stopAt(0);
  }

  /** Move the playhead (timeline beats); works while playing or stopped. */
  seek(beat: number): void {
    let b = Math.max(0, beat);
    const loop = this.activeLoop;
    if (loop && (b < loop.startBeat || b >= loop.endBeat)) b = loop.startBeat;
    if (this.isPlaying) this.releaseAll();
    Tone.getTransport().ticks = Math.round(b * PPQ);
  }

  get isPlaying(): boolean {
    return Tone.getTransport().state === "started";
  }

  /** Playhead position on the timeline, in beats (float). */
  currentBeat(): number {
    const transport = Tone.getTransport();
    // While playing, read the position being heard right now; transport
    // .ticks is the scheduling position, a look-ahead in the future. When
    // stopped, .ticks is where play will start (a seek lands there at once).
    const ticks = this.isPlaying
      ? transport.getTicksAtTime(Tone.immediate())
      : transport.ticks;
    const beat = ticks / PPQ;
    const loop = this.activeLoop;
    if (!loop || beat < loop.endBeat) return beat;
    // Right at the wrap the transport can briefly report the loop end itself.
    const length = loop.endBeat - loop.startBeat;
    return loop.startBeat + ((beat - loop.startBeat) % length);
  }

  /**
   * Render the whole song (0 to its end) or `passes` passes of the loop
   * region (the whole song when there is none), plus a 1 s tail, to WAV bytes.
   * Tone.Offline runs in its OWN AudioContext, so the live voices (which
   * belong to the real context) cannot be used: fresh voices and a fresh
   * master chain are built inside the offline callback. Notes are placed at
   * absolute times, so the offline transport is not needed.
   */
  async renderWav(
    song: Song,
    options: { range: "song" | "loop"; passes?: number },
  ): Promise<Uint8Array> {
    const region = options.range === "loop" ? song.loopRegion : null;
    const from = region ? region.startBeat : 0;
    const to = region ? region.endBeat : songEndBeat(song);
    const passes = region ? Math.max(1, Math.round(options.passes ?? 1)) : 1;
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
