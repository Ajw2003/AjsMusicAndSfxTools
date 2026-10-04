import { describe, expect, it } from "vitest";
import { countInNumber } from "./count-in";

describe("countInNumber", () => {
  it("counts 4, 3, 2, 1 on the clicks, then ends", () => {
    const at = (t: number) => countInNumber(t, 10, 0.5, 4);
    expect(at(9)).toBe(4); // before the first click
    expect(at(10)).toBe(4);
    expect(at(10.49)).toBe(4);
    expect(at(10.5)).toBe(3);
    expect(at(11.2)).toBe(2);
    expect(at(11.9)).toBe(1);
    expect(at(12)).toBeNull();
  });
  it("is null for a nonsense tempo", () => {
    expect(countInNumber(1, 0, 0, 4)).toBeNull();
  });
});
