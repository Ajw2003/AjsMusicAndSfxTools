import { describe, expect, it } from "vitest";
import { getLayout } from "./key-layouts";
import {
  clampOctave,
  codeForMidi,
  midiForCode,
  octaveBaseMidi,
  pianoKeys,
} from "./piano-keys";

describe("piano keys", () => {
  it("maps octave to base midi", () => {
    expect(octaveBaseMidi(4)).toBe(60);
    expect(octaveBaseMidi(1)).toBe(24);
  });

  it("clamps octaves to 1..7", () => {
    expect(clampOctave(0)).toBe(1);
    expect(clampOctave(9)).toBe(7);
    expect(clampOctave(4)).toBe(4);
  });

  it("builds two octaves plus the closing C with correct black keys", () => {
    const keys = pianoKeys(60);
    expect(keys).toHaveLength(25);
    expect(keys.filter((k) => !k.isBlack)).toHaveLength(15);
    expect(keys[1]).toEqual({ midi: 61, isBlack: true });
    expect(keys[24]).toEqual({ midi: 84, isBlack: false });
  });

  it("finds bound computer keys both ways", () => {
    const piano = getLayout("piano");
    expect(codeForMidi(piano, 60, 60)).toBe("KeyA");
    expect(codeForMidi(piano, 60, 84)).toBeUndefined();
    expect(midiForCode(piano, 60, "KeyW")).toBe(61);
    expect(midiForCode(piano, 60, "KeyQ")).toBeUndefined();
    expect(midiForCode(piano, 126, "Semicolon")).toBeUndefined();
  });
});
