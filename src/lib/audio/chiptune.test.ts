import { describe, expect, it } from "vitest";
import { CHIPTUNE_PRESETS, getPreset } from "./chiptune";

describe("chiptune presets", () => {
  it("has four presets with unique ids and colours", () => {
    expect(CHIPTUNE_PRESETS).toHaveLength(4);
    expect(new Set(CHIPTUNE_PRESETS.map((p) => p.id)).size).toBe(4);
    expect(new Set(CHIPTUNE_PRESETS.map((p) => p.colour)).size).toBe(4);
  });
  it("uses CSS hex colours", () => {
    for (const p of CHIPTUNE_PRESETS)
      expect(p.colour).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("looks up by id", () => {
    expect(getPreset("pulse").wave).toEqual({ kind: "pulse", width: 0.25 });
    expect(getPreset("triangle").isPolyphonic).toBe(false);
    expect(getPreset("square").colour).toBe("#4fc3f7");
  });
  it("throws for an unknown id", () => {
    expect(() => getPreset("nope" as never)).toThrow("nope");
  });
});
