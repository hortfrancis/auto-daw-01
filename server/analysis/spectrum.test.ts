import { describe, expect, it } from 'vitest';
import { bandShares, framePower, hannWindow } from './spectrum.ts';

const RATE = 48_000;

function sine(frequency: number, frames: number) {
  return Float32Array.from({ length: frames }, (_, i) => Math.sin((2 * Math.PI * frequency * i) / RATE));
}

describe('framePower', () => {
  it('puts a pure tone in its frequency bin', () => {
    const size = 1024;
    const bin = 37;
    const power = framePower(sine((bin * RATE) / size, size), 0, hannWindow(size));

    expect(power.indexOf(Math.max(...power))).toBe(bin);
  });
});

describe('bandShares', () => {
  it.each([
    [100, 0],
    [1000, 1],
    [8000, 2],
  ])('puts nearly all of a %d Hz tone in the right band', (frequency, band) => {
    const shares = bandShares(sine(frequency, RATE), RATE)!;

    expect(shares[band]).toBeGreaterThan(0.99);
  });

  it('is undefined for silence', () => {
    expect(bandShares(new Float32Array(RATE), RATE)).toBeUndefined();
  });
});
