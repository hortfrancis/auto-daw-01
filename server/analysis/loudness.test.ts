import { describe, expect, it } from 'vitest';
import { createLoudnessMeter, kWeightingFilters } from './loudness.ts';

const RATE = 48_000;

function sine(frequency: number, dbfs: number, seconds: number) {
  const amplitude = 10 ** (dbfs / 20);
  return Float32Array.from({ length: seconds * RATE }, (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * i) / RATE));
}

describe('kWeightingFilters', () => {
  it('matches the coefficients published in BS.1770 at 48 kHz', () => {
    const [shelf, highPass] = kWeightingFilters(RATE);

    expect(shelf.b0).toBeCloseTo(1.53512485958697, 8);
    expect(shelf.b1).toBeCloseTo(-2.69169618940638, 8);
    expect(shelf.b2).toBeCloseTo(1.19839281085285, 8);
    expect(shelf.a1).toBeCloseTo(-1.69065929318241, 8);
    expect(shelf.a2).toBeCloseTo(0.73248077421585, 8);
    expect(highPass.a1).toBeCloseTo(-1.99004745483398, 8);
    expect(highPass.a2).toBeCloseTo(0.99007225036621, 8);
  });
});

describe('createLoudnessMeter', () => {
  it('reads the EBU Tech 3341 reference: a 1 kHz stereo sine at -23 dBFS is -23 LUFS', () => {
    const tone = sine(1000, -23, 20);

    expect(createLoudnessMeter([tone, tone], RATE).integrated()).toBeCloseTo(-23, 1);
  });

  it('gates out silence, so a quiet gap does not lower integrated loudness', () => {
    const tone = sine(1000, -23, 10);
    const withGap = new Float32Array(20 * RATE);
    withGap.set(tone);

    const meter = createLoudnessMeter([withGap, withGap], RATE);

    // Within 0.1 LU: the few 400 ms blocks that straddle the end of the tone
    // are partly silent but still pass the gate, so they pull it down slightly.
    expect(Math.abs(meter.integrated() - -23)).toBeLessThan(0.1);
    expect(meter.between(0, 10 * RATE)).toBeCloseTo(-23, 1);
    // Not -Infinity: the K-weighting filters ring on briefly after the tone
    // stops. It's far below the -70 LUFS silence gate, though.
    expect(meter.between(10 * RATE, 20 * RATE)).toBeLessThan(-70);
  });

  it('reports silence as -Infinity', () => {
    const silence = new Float32Array(RATE);

    expect(createLoudnessMeter([silence, silence], RATE).integrated()).toBe(-Infinity);
  });
});
