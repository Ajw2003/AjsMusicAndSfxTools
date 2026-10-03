import { describe, expect, it } from "vitest";
import { noteSummary, positionLabel } from "./loop-view";

describe("loop view helpers", () => {
  it("summarises counts", () => {
    expect(noteSummary(0)).toBe("No notes");
    expect(noteSummary(1)).toBe("1 note");
    expect(noteSummary(12)).toBe("12 notes");
  });
  it("labels positions", () => {
    expect(positionLabel(0, 4)).toBe("Bar 1 · Beat 1");
    expect(positionLabel(6.9, 4)).toBe("Bar 2 · Beat 3");
  });
});
