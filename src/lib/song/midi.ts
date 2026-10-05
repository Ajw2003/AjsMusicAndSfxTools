import type { ChiptuneSoundId } from "../audio/chiptune";
import { drumKind, type DrumKind } from "../audio/drums";
import { expandClipNotes, type Song, type Track } from "./song";

const TICKS_PER_BEAT = 480;
const DRUM_CHANNEL = 9;

const DRUM_PITCH: Record<DrumKind, number> = { kick: 36, snare: 38, hat: 42 };

/** General MIDI program numbers, zero-based. */
const PROGRAM: Record<Exclude<ChiptuneSoundId, "noise">, number> = {
  square: 80,
  pulse: 80,
  triangle: 38,
};

/** Encode a number as a MIDI variable-length quantity. */
export function encodeVlq(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const out = [v & 0x7f];
  v = Math.floor(v / 128);
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  return out;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function chunk(type: string, body: number[]): number[] {
  return [
    ...[...type].map((c) => c.charCodeAt(0)),
    ...u32(body.length),
    ...body,
  ];
}

interface Event {
  tick: number;
  /** 0 = note-off, 1 = note-on, so offs sort first at equal ticks. */
  order: number;
  bytes: number[];
}

function withGain(velocity: number, gainDb: number): number {
  return Math.min(1, Math.max(0, velocity * Math.pow(10, gainDb / 20)));
}

function isExportable(track: Track): boolean {
  return track.kind === "notes" && !track.isMuted;
}

function hasNotes(track: Track): boolean {
  return track.clips.some((c) => expandClipNotes(c).length > 0);
}

/** True when at least one unmuted note track has a note to export. */
export function hasMidiNotes(song: Song): boolean {
  return song.tracks.some((t) => isExportable(t) && hasNotes(t));
}

function noteTrack(track: Track, channel: number): number[] {
  const name = [...new TextEncoder().encode(track.name)];
  const body: number[] = [0, 0xff, 0x03, ...encodeVlq(name.length), ...name];
  const isDrums = channel === DRUM_CHANNEL;
  if (!isDrums) {
    body.push(0, 0xc0 | channel, PROGRAM[track.sound as keyof typeof PROGRAM]);
  }
  const events: Event[] = [];
  for (const clip of track.clips) {
    for (const n of expandClipNotes(clip)) {
      const pitch = isDrums ? DRUM_PITCH[drumKind(n.pitch)] : n.pitch;
      const vel = Math.max(
        1,
        Math.min(127, Math.round(withGain(n.velocity, clip.gainDb) * 127)),
      );
      const on = Math.round(n.startBeat * TICKS_PER_BEAT);
      const off = Math.max(
        on + 1,
        Math.round((n.startBeat + n.durationBeats) * TICKS_PER_BEAT),
      );
      events.push({ tick: on, order: 1, bytes: [0x90 | channel, pitch, vel] });
      events.push({ tick: off, order: 0, bytes: [0x80 | channel, pitch, 0] });
    }
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  let last = 0;
  for (const e of events) {
    body.push(...encodeVlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  return chunk("MTrk", body);
}

/**
 * Encode a song as a Standard MIDI File (format 1, 480 ticks per beat).
 * Track 0 holds tempo and time signature; each unmuted note track follows.
 */
export function encodeMidi(song: Song): Uint8Array {
  const tracks = song.tracks.filter(isExportable);
  const micros = Math.round(60_000_000 / song.bpm);
  const conductor = [
    0,
    0xff,
    0x51,
    0x03,
    (micros >>> 16) & 255,
    (micros >>> 8) & 255,
    micros & 255,
    0,
    0xff,
    0x58,
    0x04,
    song.beatsPerBar,
    2,
    24,
    8,
    0,
    0xff,
    0x2f,
    0,
  ];
  const parts = [chunk("MTrk", conductor)];
  let next = 0;
  for (const track of tracks) {
    let channel = DRUM_CHANNEL;
    if (track.sound !== "noise") {
      if (next === DRUM_CHANNEL) next++;
      channel = next;
      next = (next + 1) % 16;
    }
    parts.push(noteTrack(track, channel));
  }
  const header = chunk("MThd", [
    0,
    1,
    (parts.length >> 8) & 255,
    parts.length & 255,
    (TICKS_PER_BEAT >> 8) & 255,
    TICKS_PER_BEAT & 255,
  ]);
  return new Uint8Array([...header, ...parts.flat()]);
}

/** Plain-English lines about what a MIDI file leaves out, for the UI. */
export function midiExportNotes(song: Song): string[] {
  const lines = ["Track volume and sound shapes are not saved in MIDI files."];
  if (song.tracks.some((t) => isExportable(t) && t.sound === "noise")) {
    lines.push("Noise drums use General MIDI kick, snare and hi-hat.");
  }
  if (song.tracks.some((t) => t.kind === "notes" && t.isMuted)) {
    lines.push("Muted tracks are left out.");
  }
  return lines;
}
