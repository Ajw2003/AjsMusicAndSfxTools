import { describe, expect, it } from "vitest";
import {
  chordName,
  chordPitches,
  diatonicChords,
  progressionBeats,
  progressionContent,
} from "./chords";

describe("chord names and pitches", () => {
  it("names chords with short suffixes", () => {
    expect(chordName(0, "major")).toBe("C");
    expect(chordName(9, "minor")).toBe("Am");
    expect(chordName(11, "diminished")).toBe("Bdim");
    expect(chordName(7, "dominant7")).toBe("G7");
    expect(chordName(-1, "major7")).toBe("Bmaj7");
  });
  it("voices every root between C3 and B3", () => {
    expect(chordPitches(0, "major")).toEqual([48, 52, 55]);
    expect(chordPitches(9, "minor")).toEqual([57, 60, 64]);
    expect(chordPitches(7, "dominant7")).toEqual([55, 59, 62, 65]);
  });
});

describe("chords in a key", () => {
  it("gives the seven chords of C major", () => {
    const chords = diatonicChords(0, "major");
    expect(chords.map((c) => c.name)).toEqual([
      "C",
      "Dm",
      "Em",
      "F",
      "G",
      "Am",
      "Bdim",
    ]);
    expect(chords.map((c) => c.numeral)).toEqual([
      "I",
      "ii",
      "iii",
      "IV",
      "V",
      "vi",
      "vii°",
    ]);
  });
  it("gives the seven chords of A minor", () => {
    expect(diatonicChords(9, "minor").map((c) => c.name)).toEqual([
      "Am",
      "Bdim",
      "C",
      "Dm",
      "Em",
      "F",
      "G",
    ]);
  });
  it("works in a sharp key: I–V–vi–IV in E is E B C#m A", () => {
    const e = diatonicChords(4, "major");
    expect([0, 4, 5, 3].map((d) => e[d].name)).toEqual(["E", "B", "C#m", "A"]);
  });
});

describe("progressions", () => {
  const prog = [
    { root: 0, quality: "major" as const, beats: 4 },
    { root: 7, quality: "major" as const, beats: 2 },
  ];
  it("adds up the length", () => {
    expect(progressionBeats(prog)).toBe(6);
  });
  it("places chords back to back with labels", () => {
    const { notes, labels } = progressionContent(prog);
    expect(labels).toEqual([
      { startBeat: 0, name: "C" },
      { startBeat: 4, name: "G" },
    ]);
    expect(notes.filter((n) => n.startBeat === 0).map((n) => n.pitch)).toEqual([
      48, 52, 55,
    ]);
    expect(notes.filter((n) => n.startBeat === 4).map((n) => n.pitch)).toEqual([
      55, 59, 62,
    ]);
    expect(
      notes.every((n) => n.durationBeats === (n.startBeat === 0 ? 4 : 2)),
    ).toBe(true);
  });
});
