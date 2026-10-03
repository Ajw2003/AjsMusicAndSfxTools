import { describe, expect, it } from "vitest";
import { drumKind, drumLabel } from "./drums";

describe("drums", () => {
  it("maps pitch ranges to drums", () => {
    expect(drumLabel(48)).toBe("Kick");
    expect(drumLabel(59)).toBe("Kick");
    expect(drumLabel(60)).toBe("Snare");
    expect(drumLabel(71)).toBe("Snare");
    expect(drumLabel(72)).toBe("Hat");
    expect(drumLabel(83)).toBe("Hat");
  });
  it("exposes the kind", () => {
    expect(drumKind(0)).toBe("kick");
    expect(drumKind(127)).toBe("hat");
  });
});
