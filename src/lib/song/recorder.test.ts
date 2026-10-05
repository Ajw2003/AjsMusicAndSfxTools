import { describe, expect, it } from "vitest";
import { TakeRecorder } from "./recorder";

describe("TakeRecorder", () => {
  it("records a normal note", () => {
    const r = new TakeRecorder();
    r.noteOn(60, 0.8, 1);
    r.noteOff(60, 1.5);
    const [n] = r.collect(16);
    expect(n).toMatchObject({
      pitch: 60,
      startBeat: 1,
      durationBeats: 0.5,
      velocity: 0.8,
    });
    expect(r.collect(16)).toEqual([]);
  });

  it("handles wrap-around by adding the loop length", () => {
    const r = new TakeRecorder();
    r.noteOn(62, 0.8, 15.5);
    r.noteOff(62, 0.5);
    const [n] = r.collect(16);
    expect(n.startBeat).toBe(15.5);
    // 1 beat long, then cut to the loop end (0.5 left).
    expect(n.durationBeats).toBe(0.5);
  });

  it("keeps held notes pending across collect", () => {
    const r = new TakeRecorder();
    r.noteOn(64, 0.8, 3);
    expect(r.collect(16)).toEqual([]);
    expect(r.heldCount).toBe(1);
    r.noteOff(64, 4);
    expect(r.collect(16)).toHaveLength(1);
  });

  it("quantizes the start but not the duration", () => {
    const r = new TakeRecorder();
    r.quantizeGrid = 0.5;
    r.noteOn(60, 0.8, 1.2);
    r.noteOff(60, 1.62);
    const [n] = r.collect(16);
    expect(n.startBeat).toBe(1);
    expect(n.durationBeats).toBeCloseTo(0.42);
  });

  it("wraps a start quantized up to the loop end", () => {
    const r = new TakeRecorder();
    r.quantizeGrid = 1;
    r.noteOn(60, 0.8, 15.7);
    r.noteOff(60, 15.9);
    expect(r.collect(16)[0].startBeat).toBe(0);
  });

  it("flushAll closes held notes at the given beat", () => {
    const r = new TakeRecorder();
    r.noteOn(60, 0.8, 2);
    r.noteOn(67, 0.5, 2.5);
    r.noteOff(67, 3);
    const notes = r.flushAll(4, 16);
    expect(notes).toHaveLength(2);
    expect(notes.find((n) => n.pitch === 60)?.durationBeats).toBe(2);
    expect(r.heldCount).toBe(0);
  });

  it("ignores a note off with no matching on", () => {
    const r = new TakeRecorder();
    r.noteOff(60, 1);
    expect(r.collect(16)).toEqual([]);
  });
  it("keeps timeline beats when collected without a loop length", () => {
    const r = new TakeRecorder();
    r.noteOn(60, 0.8, 30);
    r.noteOff(60, 31.5);
    r.noteOn(62, 0.8, 70);
    const notes = r.flushAll(72);
    expect(notes.map((x) => [x.startBeat, x.durationBeats])).toEqual([
      [30, 1.5],
      [70, 2],
    ]);
  });
});
