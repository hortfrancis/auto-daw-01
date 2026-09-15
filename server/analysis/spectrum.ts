/** The frequency bands used to describe a mix's balance. */
export const BANDS = [
  { name: 'low', label: 'below 250 Hz', below: 250 },
  { name: 'mid', label: '250 Hz–4 kHz', below: 4000 },
  { name: 'high', label: 'above 4 kHz', below: Infinity },
] as const;

const BALANCE_FFT_SIZE = 4096;

/** In-place fast Fourier transform. The length must be a power of two. */
export function fft(real: Float64Array, imaginary: Float64Array) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = real[i];
      real[i] = real[j];
      real[j] = r;
      const m = imaginary[i];
      imaginary[i] = imaginary[j];
      imaginary[j] = m;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const stepReal = Math.cos((-2 * Math.PI) / size);
    const stepImaginary = Math.sin((-2 * Math.PI) / size);
    for (let start = 0; start < n; start += size) {
      let wReal = 1;
      let wImaginary = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const tReal = real[b] * wReal - imaginary[b] * wImaginary;
        const tImaginary = real[b] * wImaginary + imaginary[b] * wReal;
        real[b] = real[a] - tReal;
        imaginary[b] = imaginary[a] - tImaginary;
        real[a] += tReal;
        imaginary[a] += tImaginary;
        const nextReal = wReal * stepReal - wImaginary * stepImaginary;
        wImaginary = wReal * stepImaginary + wImaginary * stepReal;
        wReal = nextReal;
      }
    }
  }
}

export function hannWindow(size: number) {
  return Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
}

/**
 * Power in each frequency bin for one windowed frame of `samples`, starting at
 * `start`. Samples outside the signal count as silence.
 */
export function framePower(samples: Float32Array, start: number, window: Float64Array) {
  const size = window.length;
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const at = start + i;
    real[i] = at >= 0 && at < samples.length ? samples[at] * window[i] : 0;
  }
  fft(real, imaginary);
  const power = new Float64Array(size / 2);
  for (let bin = 0; bin < size / 2; bin++) power[bin] = real[bin] ** 2 + imaginary[bin] ** 2;
  return power;
}

/**
 * The share of spectral energy (0–1) in each of BANDS, over the whole signal.
 * Undefined when the signal is silent.
 */
export function bandShares(samples: Float32Array, sampleRate: number): number[] | undefined {
  const window = hannWindow(BALANCE_FFT_SIZE);
  const totals = BANDS.map(() => 0);
  for (let start = 0; start < samples.length; start += BALANCE_FFT_SIZE / 2) {
    const power = framePower(samples, start, window);
    for (let bin = 1; bin < power.length; bin++) {
      const frequency = (bin * sampleRate) / BALANCE_FFT_SIZE;
      totals[BANDS.findIndex((band) => frequency < band.below)] += power[bin];
    }
  }
  const total = totals.reduce((sum, value) => sum + value, 0);
  return total > 0 ? totals.map((value) => value / total) : undefined;
}
