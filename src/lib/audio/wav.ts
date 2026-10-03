/**
 * Encode channels of float samples as a 16-bit PCM WAV file (interleaved,
 * little-endian, 44-byte header). Samples outside [-1, 1] are clamped.
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
): Uint8Array {
  if (channels.length === 0) {
    throw new RangeError("Cannot encode WAV: no channels given.");
  }
  const frames = channels[0].length;
  if (channels.some((c) => c.length !== frames)) {
    throw new RangeError("Cannot encode WAV: channels differ in length.");
  }
  const numChannels = channels.length;
  const dataSize = frames * numChannels * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][f]));
      // Asymmetric scale so -1 maps to -32768 and +1 to 32767.
      view.setInt16(offset, Math.round(s * (s < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
  }
  return bytes;
}
