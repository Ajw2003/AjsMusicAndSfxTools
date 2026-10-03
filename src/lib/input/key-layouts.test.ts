import { describe, expect, it } from "vitest";
import { KEY_LAYOUTS, getLayout, keyLabel } from "./key-layouts";

describe("key layouts", () => {
  for (const layout of KEY_LAYOUTS) {
    describe(layout.name, () => {
      it("has no duplicate offsets", () => {
        const offsets = Object.values(layout.notes);
        expect(new Set(offsets).size).toBe(offsets.length);
      });
      it("keeps octave keys out of the note keys", () => {
        expect(layout.notes).not.toHaveProperty(layout.octaveDownCode);
        expect(layout.notes).not.toHaveProperty(layout.octaveUpCode);
      });
    });
  }
  it("has the expected sizes and spots", () => {
    expect(Object.keys(getLayout("piano").notes)).toHaveLength(17);
    expect(getLayout("piano").notes.Semicolon).toBe(16);
    const full = getLayout("full");
    expect(Object.keys(full.notes)).toHaveLength(30);
    expect(full.notes.Slash).toBe(9);
    expect(full.notes.KeyA).toBe(12);
    expect(full.notes.KeyP).toBe(33);
  });
  it("throws for unknown layout", () => {
    expect(() => getLayout("x" as never)).toThrow("x");
  });
  it("labels keys", () => {
    expect(keyLabel("KeyA")).toBe("A");
    expect(keyLabel("Semicolon")).toBe(";");
    expect(keyLabel("Comma")).toBe(",");
    expect(keyLabel("Period")).toBe(".");
    expect(keyLabel("Slash")).toBe("/");
    expect(keyLabel("Minus")).toBe("-");
    expect(keyLabel("Equal")).toBe("=");
    expect(keyLabel("Digit5")).toBe("5");
    expect(keyLabel("Space")).toBe("Space");
  });
});
