import { describe, expect, it } from "vitest";
import { CHIPTUNE_PRESETS, getPreset } from "./chiptune";

describe("chiptune presets", () => {
  it("has eleven presets with unique ids and colours", () => {
    expect(CHIPTUNE_PRESETS).toHaveLength(11);
    expect(new Set(CHIPTUNE_PRESETS.map((p) => p.id)).size).toBe(11);
    expect(new Set(CHIPTUNE_PRESETS.map((p) => p.colour)).size).toBe(11);
  });
  it("has a recording on disk for every sampled note", () => {
    const files = new Set(
      Object.keys(import.meta.glob("/public/samples/*/*.mp3")),
    );
    for (const p of CHIPTUNE_PRESETS) {
      if (p.wave.kind !== "sampled") continue;
      for (const note of p.wave.notes) {
        const file = `/public/samples/${p.wave.folder}/${note}.mp3`;
        expect(files.has(file), file).toBe(true);
      }
    }
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
