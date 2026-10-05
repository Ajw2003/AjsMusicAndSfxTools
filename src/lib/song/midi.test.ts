import { describe, expect, it } from "vitest";
import { encodeMidi, encodeVlq, hasMidiNotes, midiExportNotes } from "./midi";
import { createNoteClip, createSong, createTrack, type Song } from "./song";
import type { ChiptuneSoundId } from "../audio/chiptune";

interface Ev {
  tick: number;
  bytes: number[];
}

function parse(b: Uint8Array) {
  const text = (i: number) => String.fromCharCode(...b.slice(i, i + 4));
  const u32 = (i: number) =>
    ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  expect(text(0)).toBe("MThd");
  expect(u32(4)).toBe(6);
  const header = { format: u16(8), ntrks: u16(10), division: u16(12) };
  const tracks: Ev[][] = [];
  let p = 14;
  while (p < b.length) {
    expect(text(p)).toBe("MTrk");
    const end = p + 8 + u32(p + 4);
    p += 8;
    const evs: Ev[] = [];
    let tick = 0;
    while (p < end) {
      let d = 0;
      while (b[p] & 0x80) d = d * 128 + (b[p++] & 0x7f);
      d = d * 128 + b[p++];
      tick += d;
      const start = p;
      const status = b[p++];
      if (status === 0xff) {
        p++;
        p += b[p] + 1; // lengths in these tests are < 128
      } else if ((status & 0xf0) === 0xc0) p += 1;
      else p += 2;
      evs.push({ tick, bytes: [...b.slice(start, p)] });
    }
    tracks.push(evs);
  }
  return { header, tracks };
}

const ons = (evs: Ev[]) =>
  evs.filter((e) => (e.bytes[0] & 0xf0) === 0x90 && e.bytes[2] > 0);

function songWith(
  sound: ChiptuneSoundId,
  pitches: number[],
  tweak: (s: Song) => void = () => {},
): Song {
  const s = createSong();
  s.tracks = [createTrack(sound)];
  const clip = createNoteClip(0, 4);
  clip.content = {
    kind: "notes",
    notes: pitches.map((pitch, i) => ({
      id: `n${i}`,
      pitch,
      startBeat: i,
      durationBeats: 0.5,
      velocity: 1,
    })),
  };
  s.tracks[0].clips = [clip];
  tweak(s);
  return s;
}

describe("encodeVlq", () => {
  it("handles boundaries", () => {
    expect(encodeVlq(0)).toEqual([0]);
    expect(encodeVlq(127)).toEqual([0x7f]);
    expect(encodeVlq(128)).toEqual([0x81, 0x00]);
    expect(encodeVlq(16383)).toEqual([0xff, 0x7f]);
    expect(encodeVlq(16384)).toEqual([0x81, 0x80, 0x00]);
    expect(encodeVlq(0x0fffffff)).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });
});

describe("encodeMidi", () => {
  it("writes header, tempo and time signature", () => {
    const s = songWith("square", [60], (x) => (x.bpm = 120));
    const { header, tracks } = parse(encodeMidi(s));
    expect(header).toEqual({ format: 1, ntrks: 2, division: 480 });
    expect(tracks[0][0].bytes).toEqual([0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]);
    expect(tracks[0][1].bytes).toEqual([0xff, 0x58, 0x04, 4, 2, 24, 8]);
  });

  it("repeats a short loop, transposes and names the track", () => {
    const s = songWith("square", [60, 62], (x) => {
      const c = x.tracks[0].clips[0];
      c.loopBeats = 2;
      c.lengthBeats = 6;
      c.transpose = 2;
    });
    const { tracks } = parse(encodeMidi(s));
    expect(tracks[1][0].bytes.slice(0, 2)).toEqual([0xff, 0x03]);
    expect(tracks[1][1].bytes).toEqual([0xc0, 80]);
    const on = ons(tracks[1]);
    expect(on.map((e) => e.bytes[1])).toEqual([62, 64, 62, 64, 62, 64]);
    expect(on.map((e) => e.tick)).toEqual([0, 480, 960, 1440, 1920, 2400]);
  });

  it("maps drums to channel 9 and triangle to a bass program", () => {
    const { tracks } = parse(encodeMidi(songWith("noise", [48, 62, 80])));
    const on = ons(tracks[1]);
    expect(on.map((e) => e.bytes[0])).toEqual([0x99, 0x99, 0x99]);
    expect(on.map((e) => e.bytes[1])).toEqual([36, 38, 42]);
    expect(tracks[1].some((e) => (e.bytes[0] & 0xf0) === 0xc0)).toBe(false);
    const tri = parse(encodeMidi(songWith("triangle", [60])));
    expect(tri.tracks[1][1].bytes).toEqual([0xc0, 38]);
  });

  it("lowers velocity with clip gain", () => {
    const loud = parse(encodeMidi(songWith("square", [60])));
    const quiet = parse(
      encodeMidi(
        songWith("square", [60], (x) => (x.tracks[0].clips[0].gainDb = -6)),
      ),
    );
    expect(ons(loud.tracks[1])[0].bytes[2]).toBe(127);
    expect(ons(quiet.tracks[1])[0].bytes[2]).toBeLessThan(127);
    expect(ons(quiet.tracks[1])[0].bytes[2]).toBeGreaterThan(0);
  });

  it("leaves out muted tracks and skips channel 9 for pitched tracks", () => {
    const s = songWith("square", [60]);
    const muted = createTrack("pulse");
    muted.isMuted = true;
    s.tracks.push(muted);
    expect(parse(encodeMidi(s)).header.ntrks).toBe(2);
    expect(midiExportNotes(s)).toContain("Muted tracks are left out.");
    const many = songWith("square", [60]);
    for (let i = 0; i < 10; i++) many.tracks.push({ ...many.tracks[0] });
    const channels = parse(encodeMidi(many))
      .tracks.slice(1)
      .map((t) => ons(t)[0].bytes[0] & 15);
    expect(channels).not.toContain(9);
  });

  it("puts note-offs before note-ons at the same tick", () => {
    const s = songWith("square", [60, 62], (x) => {
      x.tracks[0].clips[0].content = {
        kind: "notes",
        notes: [
          { id: "a", pitch: 60, startBeat: 0, durationBeats: 1, velocity: 1 },
          { id: "b", pitch: 62, startBeat: 1, durationBeats: 1, velocity: 1 },
        ],
      };
    });
    const evs = parse(encodeMidi(s)).tracks[1].filter(
      (e) => e.tick === 480 && e.bytes[0] !== 0xff,
    );
    expect(evs.map((e) => e.bytes[0] & 0xf0)).toEqual([0x80, 0x90]);
  });
});

describe("midiExportNotes / hasMidiNotes", () => {
  it("lists what is left out", () => {
    const s = songWith("noise", [36]);
    expect(midiExportNotes(s)).toEqual([
      "Track volume and sound shapes are not saved in MIDI files.",
      "Noise drums use General MIDI kick, snare and hi-hat.",
    ]);
    expect(hasMidiNotes(s)).toBe(true);
    s.tracks[0].isMuted = true;
    expect(hasMidiNotes(s)).toBe(false);
    expect(hasMidiNotes(createSong())).toBe(false);
  });
});
