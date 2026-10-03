import { describe, expect, it } from "vitest";
import { midiToNoteName } from "./note-names";

describe("midiToNoteName", () => {
  it("names known notes", () => {
    expect(midiToNoteName(60)).toBe("C4");
    expect(midiToNoteName(61)).toBe("C#4");
    expect(midiToNoteName(69)).toBe("A4");
    expect(midiToNoteName(21)).toBe("A0");
    expect(midiToNoteName(0)).toBe("C-1");
    expect(midiToNoteName(127)).toBe("G9");
  });

  it("throws RangeError for non-integers and out-of-range values", () => {
    expect(() => midiToNoteName(60.5)).toThrow(RangeError);
    expect(() => midiToNoteName(NaN)).toThrow(RangeError);
    expect(() => midiToNoteName(-1)).toThrow(RangeError);
    expect(() => midiToNoteName(128)).toThrow(RangeError);
  });
});
