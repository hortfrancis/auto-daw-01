// Loudness in LUFS, as defined by ITU-R BS.1770-4: the measure behind
// streaming loudness targets (around -14 LUFS). Every channel is weighted
// equally, which is right for mono and stereo.

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

const BLOCK_SECONDS = 0.4;
const STEP_SECONDS = 0.1; // blocks overlap by 75%
const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = 10;

/**
 * The two K-weighting filters (a high shelf, then a high-pass), derived for
 * any sample rate. At 48 kHz they match the coefficients published in BS.1770.
 */
export function kWeightingFilters(sampleRate: number): [Biquad, Biquad] {
  const shelfK = Math.tan((Math.PI * 1681.974450955533) / sampleRate);
  const shelfQ = 0.7071752369554196;
  const vh = 10 ** (3.999843853973347 / 20);
  const vb = vh ** 0.4996667741545416;
  const shelfA0 = 1 + shelfK / shelfQ + shelfK ** 2;
  const shelf = {
    b0: (vh + (vb * shelfK) / shelfQ + shelfK ** 2) / shelfA0,
    b1: (2 * (shelfK ** 2 - vh)) / shelfA0,
    b2: (vh - (vb * shelfK) / shelfQ + shelfK ** 2) / shelfA0,
    a1: (2 * (shelfK ** 2 - 1)) / shelfA0,
    a2: (1 - shelfK / shelfQ + shelfK ** 2) / shelfA0,
  };

  const passK = Math.tan((Math.PI * 38.13547087602444) / sampleRate);
  const passQ = 0.5003270373238773;
  const passA0 = 1 + passK / passQ + passK ** 2;
  const highPass = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (passK ** 2 - 1)) / passA0,
    a2: (1 - passK / passQ + passK ** 2) / passA0,
  };

  return [shelf, highPass];
}

/** LUFS for a sum of per-channel mean squares of K-weighted samples. */
export function lufs(meanSquareSum: number) {
  return meanSquareSum > 0 ? -0.691 + 10 * Math.log10(meanSquareSum) : -Infinity;
}

/**
 * Measures loudness over any stretch of the signal. K-weights every channel
 * once up front, so each measurement afterwards is instant.
 */
export function createLoudnessMeter(channels: Float32Array[], sampleRate: number) {
  const frames = channels[0]?.length ?? 0;
  const weighted = channels.map((channel) => kWeightingFilters(sampleRate).reduce(applyBiquad, Float64Array.from(channel)));

  // energyBefore[i] is the K-weighted energy of every channel before frame i.
  const energyBefore = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (const channel of weighted) sum += channel[i] * channel[i];
    energyBefore[i + 1] = energyBefore[i] + sum;
  }
  const meanSquare = (start: number, end: number) => (end > start ? (energyBefore[end] - energyBefore[start]) / (end - start) : 0);

  return {
    /** Loudness between two frame positions, without gating. */
    between: (start: number, end: number) => lufs(meanSquare(start, end)),

    /** Integrated loudness of the whole signal, with BS.1770's gates (silence doesn't pull it down). */
    integrated() {
      const blockFrames = Math.round(BLOCK_SECONDS * sampleRate);
      const stepFrames = Math.round(STEP_SECONDS * sampleRate);
      if (frames < blockFrames) return lufs(meanSquare(0, frames));

      const blocks: number[] = [];
      for (let start = 0; start + blockFrames <= frames; start += stepFrames) blocks.push(meanSquare(start, start + blockFrames));

      const aboveAbsoluteGate = blocks.filter((block) => lufs(block) > ABSOLUTE_GATE_LUFS);
      if (aboveAbsoluteGate.length === 0) return -Infinity;
      const relativeGate = lufs(average(aboveAbsoluteGate)) - RELATIVE_GATE_LU;
      return lufs(average(aboveAbsoluteGate.filter((block) => lufs(block) > relativeGate)));
    },
  };
}

function applyBiquad(input: Float64Array, { b0, b1, b2, a1, a2 }: Biquad) {
  const output = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let n = 0; n < input.length; n++) {
    const x = input[n];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    output[n] = y;
  }
  return output;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
