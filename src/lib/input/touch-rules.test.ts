import { describe, expect, it } from "vitest";
import { LEAVE_PX, SLIDE_PX, isNearRect, nextMidi } from "./touch-rules";

const hold = { midi: 60, x: 100, y: 100 };

describe("nextMidi", () => {
  it("lets go when the finger leaves the row", () => {
    expect(nextMidi(hold, 100, 400, 62, false)).toBeNull();
  });
  it("plays again when a finger that left comes back onto a key", () => {
    expect(nextMidi({ ...hold, midi: null }, 100, 100, 64, true)).toBe(64);
  });
  it("keeps the note over a gap between keys", () => {
    expect(nextMidi(hold, 140, 100, null, true)).toBe(60);
  });
  it("keeps the note when a resting finger jitters onto the next key", () => {
    expect(nextMidi(hold, 100 + SLIDE_PX - 1, 100, 62, true)).toBe(60);
  });
  it("slides to the next key once the finger has really moved", () => {
    expect(nextMidi(hold, 100 + SLIDE_PX, 100, 62, true)).toBe(62);
  });
});

describe("isNearRect", () => {
  const rect = { left: 0, right: 300, top: 0, bottom: 150 } as DOMRectReadOnly;
  it("counts a finger just past the edge as still on the row", () => {
    expect(isNearRect(rect, 150, 150 + LEAVE_PX)).toBe(true);
  });
  it("counts a finger well past the edge as off the row", () => {
    expect(isNearRect(rect, 150, 150 + LEAVE_PX + 1)).toBe(false);
  });
});
