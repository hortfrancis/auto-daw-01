import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav.ts';

function ascii(view: DataView, offset: number, length: number) {
  return String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));
}

describe('encodeWav', () => {
  it('writes a standard 16-bit PCM header', () => {
    const view = new DataView(encodeWav([new Float32Array(10), new Float32Array(10)], 48_000));

    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 40);
    expect(ascii(view, 8, 8)).toBe('WAVEfmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(192_000); // bytes per second
    expect(view.getUint16(32, true)).toBe(4); // bytes per frame
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(40);
    expect(view.byteLength).toBe(84);
  });

  it('interleaves channels and scales samples, clipping anything louder than full scale', () => {
    const left = new Float32Array([0, 1, -1, 2]);
    const right = new Float32Array([0.5, -0.5, -2, 0]);

    const view = new DataView(encodeWav([left, right], 44_100));
    const samples = Array.from({ length: 8 }, (_, i) => view.getInt16(44 + i * 2, true));

    expect(samples).toEqual([0, 16384, 32767, -16384, -32768, -32768, 32767, 0]);
  });
});
