import { describe, expect, it } from "vitest";
import { encodeWav } from "./wav";

const ascii = (v: DataView, o: number, n: number): string =>
  String.fromCharCode(
    ...Array.from({ length: n }, (_, i) => v.getUint8(o + i)),
  );

describe("encodeWav", () => {
  it("writes a standard header", () => {
    const out = encodeWav([new Float32Array(10), new Float32Array(10)], 44100);
    const v = new DataView(out.buffer);
    expect(out.length).toBe(44 + 40);
    expect(ascii(v, 0, 4)).toBe("RIFF");
    expect(v.getUint32(4, true)).toBe(36 + 40);
    expect(ascii(v, 8, 4)).toBe("WAVE");
    expect(ascii(v, 12, 4)).toBe("fmt ");
    expect(v.getUint32(16, true)).toBe(16);
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(28, true)).toBe(44100 * 4);
    expect(v.getUint16(32, true)).toBe(4);
    expect(v.getUint16(34, true)).toBe(16);
    expect(ascii(v, 36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(40);
  });
  it("converts and clamps samples", () => {
    const out = encodeWav([Float32Array.from([0.5, -1, 2, -3, 0])], 8000);
    const v = new DataView(out.buffer);
    expect(v.getInt16(44, true)).toBe(16384);
    expect(v.getInt16(46, true)).toBe(-32768);
    expect(v.getInt16(48, true)).toBe(32767);
    expect(v.getInt16(50, true)).toBe(-32768);
    expect(v.getInt16(52, true)).toBe(0);
  });
  it("interleaves channels", () => {
    const out = encodeWav(
      [Float32Array.from([1, 0]), Float32Array.from([0, -1])],
      8000,
    );
    const v = new DataView(out.buffer);
    expect([44, 46, 48, 50].map((o) => v.getInt16(o, true))).toEqual([
      32767, 0, 0, -32768,
    ]);
  });
  it("rejects bad input", () => {
    expect(() => encodeWav([], 44100)).toThrow(RangeError);
    expect(() =>
      encodeWav([new Float32Array(1), new Float32Array(2)], 44100),
    ).toThrow(RangeError);
  });
});
