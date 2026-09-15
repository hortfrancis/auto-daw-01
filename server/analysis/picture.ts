// Draws a render as a picture an agent can read: the waveform above a
// spectrogram, with numbered bar lines and labelled frequency guides.

import { encodePng } from './png.ts';
import { framePower, hannWindow } from './spectrum.ts';

const WIDTH = 1200;
const WAVEFORM_HEIGHT = 100;
const GAP = 4;
const SPECTROGRAM_HEIGHT = 300;
const HEIGHT = WAVEFORM_HEIGHT + GAP + SPECTROGRAM_HEIGHT;
const SPECTROGRAM_TOP = WAVEFORM_HEIGHT + GAP;

const MIN_FREQUENCY = 30;
const MAX_FREQUENCY = 16_000;
const GUIDES = [
  { frequency: 100, label: '100 Hz' },
  { frequency: 1000, label: '1 kHz' },
  { frequency: 10_000, label: '10 kHz' },
];
const FFT_SIZE = 4096;
/** The spectrogram shows this many decibels below the loudest point; quieter is black. */
const DYNAMIC_RANGE_DB = 80;

type Color = readonly [number, number, number];
const BACKGROUND: Color = [17, 19, 23];
const WAVEFORM: Color = [95, 211, 141];
const WHITE: Color = [255, 255, 255];
// The "inferno" colour map: black through purple and orange to pale yellow.
const INFERNO: Color[] = [
  [0, 0, 4],
  [40, 11, 84],
  [101, 21, 110],
  [159, 42, 99],
  [212, 72, 66],
  [245, 125, 21],
  [250, 193, 39],
  [252, 255, 164],
];

// A tiny 5×7 pixel font: just the characters the labels need.
const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
  z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};
const TEXT_SCALE = 2;
const CHAR_WIDTH = 6 * TEXT_SCALE; // 5 pixels plus 1 of spacing
const TEXT_HEIGHT = 7 * TEXT_SCALE;
/** Bar lines closer together than this (in pixels) are thinned out to every 2nd, 4th, 8th… bar. */
const MIN_BAR_LINE_SPACING = 16;

export const PICTURE_SIZE = { width: WIDTH, height: HEIGHT };

/** How to read the picture. Sent to the agent alongside it. */
export function pictureGuide(barsPerLine: number) {
  const bars =
    barsPerLine === 1
      ? 'each bar starts at a vertical line, numbered along the top'
      : `a vertical line marks the start of every ${barsPerLine} bars (bars 1, ${barsPerLine + 1}, ${2 * barsPerLine + 1}…), numbered along the top`;
  return `The picture shows the waveform above a spectrogram. Time runs left to right: ${bars}. Frequency runs bottom to top on a log scale from 30 Hz to 16 kHz, with labelled guide lines at 100 Hz, 1 kHz and 10 kHz. Brighter means louder.`;
}

type Paint = (x: number, y: number, color: Color, opacity?: number) => void;

/**
 * Draws the picture for a mono signal, marking bars at the given frame
 * positions. Also returns how many bars each bar line stands for.
 */
export function drawPicture(samples: Float32Array, sampleRate: number, barStarts: number[]) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let i = 0; i < pixels.length; i += 3) pixels.set(BACKGROUND, i);
  const paint: Paint = (x, y, color, opacity = 1) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const i = (y * WIDTH + x) * 3;
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(pixels[i + c] * (1 - opacity) + color[c] * opacity);
  };

  if (samples.length > 0) {
    drawWaveform(samples, paint);
    drawSpectrogram(samples, sampleRate, paint);
  }

  // Frequency guide lines, labelled at the left.
  const logRange = Math.log(MAX_FREQUENCY / MIN_FREQUENCY);
  for (const { frequency, label } of GUIDES) {
    const y = SPECTROGRAM_TOP + Math.round((1 - Math.log(frequency / MIN_FREQUENCY) / logRange) * SPECTROGRAM_HEIGHT);
    for (let x = 0; x < WIDTH; x++) paint(x, y, WHITE, 0.25);
    drawLabel(paint, 4, y - TEXT_HEIGHT - 3, label);
  }

  // A line at the start of each bar (or every 2nd, 4th… bar in long songs),
  // numbered along the top. Numbers that would overlap are skipped.
  const barsPerLine = barsPerBarLine(barStarts.length);
  let labelledUpTo = -Infinity;
  barStarts.forEach((start, index) => {
    if (index % barsPerLine !== 0) return;
    const x = Math.round((start / Math.max(1, samples.length)) * WIDTH);
    if (x >= WIDTH) return;
    if (x > 0) {
      for (let y = 0; y < HEIGHT; y++) {
        if (y < WAVEFORM_HEIGHT || y >= SPECTROGRAM_TOP) paint(x, y, WHITE, 0.35);
      }
    }
    const label = String(index + 1);
    const labelX = x + 4;
    if (labelX > labelledUpTo) {
      drawLabel(paint, labelX, 4, label);
      labelledUpTo = labelX + label.length * CHAR_WIDTH + 8;
    }
  });

  return { png: encodePng(WIDTH, HEIGHT, pixels), barsPerLine };
}

/** 1, 2, 4, 8…: the fewest bars per line that keeps lines MIN_BAR_LINE_SPACING apart. */
function barsPerBarLine(bars: number) {
  let barsPerLine = 1;
  while (bars > 0 && (WIDTH / bars) * barsPerLine < MIN_BAR_LINE_SPACING) barsPerLine *= 2;
  return barsPerLine;
}

function drawWaveform(samples: Float32Array, paint: Paint) {
  const middle = WAVEFORM_HEIGHT / 2;
  const scale = middle - 2;
  const samplesPerColumn = samples.length / WIDTH;
  const toRow = (level: number) => Math.min(WAVEFORM_HEIGHT - 1, Math.max(0, Math.round(middle - level * scale)));

  for (let x = 0; x < WIDTH; x++) {
    paint(x, middle, WHITE, 0.08);
    const from = Math.floor(x * samplesPerColumn);
    const to = Math.min(samples.length, Math.max(from + 1, Math.floor((x + 1) * samplesPerColumn)));
    if (from >= samples.length) break;
    let low = 0;
    let high = 0;
    for (let i = from; i < to; i++) {
      low = Math.min(low, samples[i]);
      high = Math.max(high, samples[i]);
    }
    for (let y = toRow(high); y <= toRow(low); y++) paint(x, y, WAVEFORM);
  }
}

function drawSpectrogram(samples: Float32Array, sampleRate: number, paint: Paint) {
  const window = hannWindow(FFT_SIZE);
  const samplesPerColumn = samples.length / WIDTH;
  const logRange = Math.log(MAX_FREQUENCY / MIN_FREQUENCY);

  // The FFT bins each pixel row covers. Row 0 is the top: the highest frequency.
  const rowBins = Array.from({ length: SPECTROGRAM_HEIGHT }, (_, row) => {
    const low = MIN_FREQUENCY * Math.exp(((SPECTROGRAM_HEIGHT - 1 - row) / SPECTROGRAM_HEIGHT) * logRange);
    const high = MIN_FREQUENCY * Math.exp(((SPECTROGRAM_HEIGHT - row) / SPECTROGRAM_HEIGHT) * logRange);
    const first = Math.floor((low * FFT_SIZE) / sampleRate);
    return [first, Math.max(first, Math.ceil((high * FFT_SIZE) / sampleRate))] as const;
  });

  const levels = new Float32Array(WIDTH * SPECTROGRAM_HEIGHT).fill(-Infinity);
  let loudest = -Infinity;
  for (let x = 0; x < WIDTH; x++) {
    const center = Math.floor((x + 0.5) * samplesPerColumn);
    const power = framePower(samples, center - FFT_SIZE / 2, window);
    rowBins.forEach(([first, last], row) => {
      let strongest = 0;
      for (let bin = first; bin <= Math.min(last, power.length - 1); bin++) strongest = Math.max(strongest, power[bin]);
      const level = strongest > 0 ? 10 * Math.log10(strongest) : -Infinity;
      levels[row * WIDTH + x] = level;
      loudest = Math.max(loudest, level);
    });
  }
  if (loudest === -Infinity) return;

  for (let row = 0; row < SPECTROGRAM_HEIGHT; row++) {
    for (let x = 0; x < WIDTH; x++) {
      const brightness = (levels[row * WIDTH + x] - (loudest - DYNAMIC_RANGE_DB)) / DYNAMIC_RANGE_DB;
      paint(x, SPECTROGRAM_TOP + row, inferno(Math.min(1, Math.max(0, brightness))));
    }
  }
}

/** White text on a dark box, so it stays readable over bright spectrogram areas. */
function drawLabel(paint: Paint, left: number, top: number, text: string) {
  const width = text.length * CHAR_WIDTH;
  for (let y = top - 2; y < top + TEXT_HEIGHT + 2; y++) {
    for (let x = left - 3; x < left + width + 1; x++) paint(x, y, BACKGROUND, 0.8);
  }
  [...text].forEach((character, index) => {
    const glyph = GLYPHS[character] ?? GLYPHS[' '];
    glyph.forEach((row, glyphY) => {
      [...row].forEach((bit, glyphX) => {
        if (bit !== '1') return;
        for (let dy = 0; dy < TEXT_SCALE; dy++) {
          for (let dx = 0; dx < TEXT_SCALE; dx++) {
            paint(left + index * CHAR_WIDTH + glyphX * TEXT_SCALE + dx, top + glyphY * TEXT_SCALE + dy, WHITE);
          }
        }
      });
    });
  });
}

function inferno(t: number): Color {
  const position = t * (INFERNO.length - 1);
  const index = Math.min(INFERNO.length - 2, Math.floor(position));
  const blend = position - index;
  const [from, to] = [INFERNO[index], INFERNO[index + 1]];
  return [0, 1, 2].map((c) => Math.round(from[c] + (to[c] - from[c]) * blend)) as unknown as Color;
}
