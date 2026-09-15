import { describe, expect, it } from 'vitest';
import { encodeWav } from '../../web/audio/wav.ts';
import { decodeWav } from './wav.ts';

describe('decodeWav', () => {
  it('reads back what the browser encodes', () => {
    const left = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const right = new Float32Array([0.25, -0.25, 0, 0, 0]);

    const { sampleRate, channels } = decodeWav(Buffer.from(encodeWav([left, right], 48_000)));

    expect(sampleRate).toBe(48_000);
    expect(channels).toHaveLength(2);
    for (const [decoded, original] of [
      [channels[0], left],
      [channels[1], right],
    ]) {
      original.forEach((sample, i) => expect(decoded[i]).toBeCloseTo(sample, 4));
    }
  });

  it('explains what is wrong with a file it cannot read', () => {
    expect(() => decodeWav(Buffer.from('not audio at all'))).toThrow('Not a WAV file');
  });
});
