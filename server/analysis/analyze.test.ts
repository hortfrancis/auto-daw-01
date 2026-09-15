import { describe, expect, it } from 'vitest';
import { encodeWav } from '../../web/audio/wav.ts';
import { analyzeRender } from './analyze.ts';
import { PICTURE_SIZE } from './picture.ts';

const RATE = 48_000;

function stereoWav(samples: Float32Array) {
  return Buffer.from(encodeWav([samples, samples], RATE));
}

function sine(frequency: number, dbfs: number, frames: number) {
  const amplitude = 10 ** (dbfs / 20);
  return Float32Array.from({ length: frames }, (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * i) / RATE));
}

describe('analyzeRender', () => {
  it('describes a loud low tone in bar 1 and silence in bar 2', () => {
    const barFrames = 2 * RATE; // 2 s per bar, as at 120 BPM in 4/4
    const signal = new Float32Array(2 * barFrames);
    signal.set(sine(110, -12, barFrames)); // exactly 220 cycles, so it ends cleanly

    const { summary, picture, pictureGuide } = analyzeRender(stereoWav(signal), { bars: 2, secondsPerBar: 2 });

    expect(summary.split('\n')).toEqual([
      'Peak: -12.0 dBFS (no clipping)',
      expect.stringMatching(/^Loudness: -1\d\.\d LUFS integrated$/),
      expect.stringMatching(/^Loudness by bar \(LUFS\): 1: -1\d\.\d \| 2: silent$/),
      'Frequency balance: low (below 250 Hz) 100%, mid (250 Hz–4 kHz) 0%, high (above 4 kHz) 0%',
    ]);
    expect([picture.readUInt32BE(16), picture.readUInt32BE(20)]).toEqual([PICTURE_SIZE.width, PICTURE_SIZE.height]);
    expect(pictureGuide).toContain('each bar starts at a vertical line, numbered along the top');
  });

  it('says how much clipping there is and which bars it is in', () => {
    const signal = new Float32Array(3 * RATE);
    for (let i = RATE; i < 2 * RATE; i++) signal[i] = i % 2 === 0 ? 1 : -1; // full-scale square wave in bar 2

    const { summary } = analyzeRender(stereoWav(signal), { bars: 3, secondsPerBar: 1 });

    expect(summary).toContain('Peak: 0.0 dBFS, clipping: 48000 samples at full scale, in bar 2');
  });

  it('groups bars in long songs, so the loudness line stays short and bar lines stay apart', () => {
    const { summary, pictureGuide } = analyzeRender(stereoWav(sine(440, -20, 100 * RATE)), { bars: 100, secondsPerBar: 1 });

    const line = summary.split('\n')[2];
    expect(line).toMatch(/^Loudness by 4 bars \(LUFS\): 1–4: -\d+\.\d \| 5–8: /);
    expect(line.split(' | ')).toHaveLength(25);
    // 100 bars in 1200 pixels would put lines 12 pixels apart, so they mark every 2nd bar.
    expect(pictureGuide).toContain('a vertical line marks the start of every 2 bars (bars 1, 3, 5…)');
  });

  it('describes silence plainly', () => {
    const { summary } = analyzeRender(stereoWav(new Float32Array(RATE)), { bars: 1, secondsPerBar: 1 });

    expect(summary).toBe(
      [
        'Peak: silent (the render has no sound at all)',
        'Loudness: silent',
        'Loudness by bar (LUFS): 1: silent',
        'Frequency balance: none (silent)',
      ].join('\n'),
    );
  });
});
