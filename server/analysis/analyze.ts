// Turns a rendered WAV into what an agent can use to "hear" it: levels and
// clipping, loudness overall and bar by bar, frequency balance, and a picture.

import { createLoudnessMeter } from './loudness.ts';
import { drawPicture, pictureGuide } from './picture.ts';
import { BANDS, bandShares } from './spectrum.ts';
import { decodeWav } from './wav.ts';

/** A 16-bit sample at or beyond this is at full scale, i.e. clipping. */
const CLIP_LEVEL = 32767 / 32768;
/**
 * A bar whose samples never go above this (-80 dBFS) is silent. Decided from
 * the samples, not from loudness: the loudness filters ring on briefly after
 * sound stops, which would make a silent bar read as quiet but not silent.
 */
const SILENT_PEAK = 1e-4;
/** "Loudness by bar" lists at most this many entries; longer songs group bars. */
const MAX_LOUDNESS_ENTRIES = 32;

export type SongTiming = { bars: number; secondsPerBar: number };

type Peaks = { peak: number; clippedFrames: number; clippedBars: Set<number>; barPeaks: number[] };

export function analyzeRender(wav: Buffer, timing: SongTiming) {
  const { sampleRate, channels } = decodeWav(wav);
  const frames = channels[0]?.length ?? 0;
  const framesPerBar = timing.secondsPerBar * sampleRate;
  const barStarts = Array.from({ length: timing.bars }, (_, i) => Math.round(i * framesPerBar));
  const mono = mixToMono(channels, frames);
  const meter = createLoudnessMeter(channels, sampleRate);
  const peaks = measurePeaks(channels, frames, framesPerBar, timing.bars);

  const summary = [
    describePeak(peaks),
    describeLoudness(peaks.peak < SILENT_PEAK ? -Infinity : meter.integrated()),
    describeLoudnessByBar(meter, barStarts, frames, peaks.barPeaks),
    describeBalance(bandShares(mono, sampleRate)),
  ].join('\n');

  const { png, barsPerLine } = drawPicture(mono, sampleRate, barStarts);
  return { summary, picture: png, pictureGuide: pictureGuide(barsPerLine) };
}

function measurePeaks(channels: Float32Array[], frames: number, framesPerBar: number, bars: number): Peaks {
  const peaks: Peaks = { peak: 0, clippedFrames: 0, clippedBars: new Set(), barPeaks: new Array(bars).fill(0) };
  for (let frame = 0; frame < frames; frame++) {
    const bar = Math.min(bars - 1, Math.floor(frame / framesPerBar));
    let clipped = false;
    for (const channel of channels) {
      const level = Math.abs(channel[frame]);
      if (level > peaks.barPeaks[bar]) peaks.barPeaks[bar] = level;
      if (level >= CLIP_LEVEL) clipped = true;
    }
    if (clipped) {
      peaks.clippedFrames++;
      peaks.clippedBars.add(bar + 1);
    }
  }
  peaks.peak = Math.max(0, ...peaks.barPeaks);
  return peaks;
}

function describePeak({ peak, clippedFrames, clippedBars }: Peaks) {
  if (peak < SILENT_PEAK) return 'Peak: silent (the render has no sound at all)';
  const level = `Peak: ${formatDecibels(20 * Math.log10(peak))} dBFS`;
  return clippedFrames === 0
    ? `${level} (no clipping)`
    : `${level}, clipping: ${clippedFrames} samples at full scale, in ${formatBars([...clippedBars])}`;
}

function describeLoudness(integrated: number) {
  return integrated === -Infinity ? 'Loudness: silent' : `Loudness: ${formatDecibels(integrated)} LUFS integrated`;
}

function describeLoudnessByBar(
  meter: ReturnType<typeof createLoudnessMeter>,
  barStarts: number[],
  frames: number,
  barPeaks: number[],
) {
  const bars = barStarts.length;
  const barsPerEntry = bars <= MAX_LOUDNESS_ENTRIES ? 1 : 2 ** Math.ceil(Math.log2(bars / MAX_LOUDNESS_ENTRIES));
  const entries: string[] = [];
  for (let first = 1; first <= bars; first += barsPerEntry) {
    const last = Math.min(bars, first + barsPerEntry - 1);
    const silent = Math.max(...barPeaks.slice(first - 1, last)) < SILENT_PEAK;
    const loudness = meter.between(barStarts[first - 1], last < bars ? barStarts[last] : frames);
    const label = first === last ? `${first}` : `${first}–${last}`;
    entries.push(`${label}: ${silent ? 'silent' : formatDecibels(loudness)}`);
  }
  const unit = barsPerEntry === 1 ? 'bar' : `${barsPerEntry} bars`;
  return `Loudness by ${unit} (LUFS): ${entries.join(' | ')}`;
}

function describeBalance(shares: number[] | undefined) {
  if (!shares) return 'Frequency balance: none (silent)';
  const bands = BANDS.map((band, i) => `${band.name} (${band.label}) ${Math.round(shares[i] * 100)}%`);
  return `Frequency balance: ${bands.join(', ')}`;
}

function mixToMono(channels: Float32Array[], frames: number) {
  const mono = new Float32Array(frames);
  for (const channel of channels) {
    for (let i = 0; i < frames; i++) mono[i] += channel[i] / channels.length;
  }
  return mono;
}

/** One decimal place, never "-0.0". */
function formatDecibels(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return (rounded === 0 ? 0 : rounded).toFixed(1);
}

/** "bar 3" or "bars 1–4, 7". */
function formatBars(bars: number[]) {
  const sorted = [...bars].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    ranges.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return `${sorted.length === 1 ? 'bar' : 'bars'} ${ranges.join(', ')}`;
}
