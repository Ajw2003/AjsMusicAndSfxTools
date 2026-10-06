import { afterEach, describe, expect, it, vi } from "vitest";
import { MOTIONS, loadReading } from "./reading";

// The test environment is node (no jsdom), so storage is stubbed and only
// loadReading is covered; applyReading needs a document and is checked in
// e2e/timeline.cjs.
function stubStorage(saved: Record<string, string>): void {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved[key] ?? null,
  });
}

describe("loadReading motion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers following the device first, so that is the default", () => {
    expect(MOTIONS[0].id).toBe("device");
    stubStorage({});
    expect(loadReading().motion).toBe("device");
  });

  it("restores a saved Reduce motion choice", () => {
    stubStorage({ "ajs-music.ui.motion": "reduce" });
    expect(loadReading().motion).toBe("reduce");
  });

  it("ignores an unknown saved value", () => {
    stubStorage({ "ajs-music.ui.motion": "wobble" });
    expect(loadReading().motion).toBe("device");
  });
});
