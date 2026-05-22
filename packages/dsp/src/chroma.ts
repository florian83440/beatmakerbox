// Chromagram extraction — sum spectral energy into 12 pitch-class bins.

import { hannWindow, applyWindow } from './windowing'
import { SpectrumAnalyzer } from './fft'
import { freqToPitchClass } from './notes'

export interface ChromagramOptions {
  /** FFT window size (samples). Default 8192. Must be power of two. */
  fftSize?: number
  /** Hop between consecutive windows (samples). Default fftSize / 2. */
  hopSize?: number
  /** Lower cutoff (Hz) for pitch-class mapping. Default ~C2. */
  minFreq?: number
  /** Upper cutoff (Hz) for pitch-class mapping. Default ~C7. */
  maxFreq?: number
}

/**
 * Compute a normalized 12-bin chromagram from a mono signal.
 *
 * Each bin sums the *power* (squared magnitude) of FFT bins that fall on
 * that pitch class, across all windows. The vector is L1-normalized so
 * profile correlation is scale-invariant.
 */
export function computeChromagram(
  signal: Float32Array,
  sampleRate: number,
  opts: ChromagramOptions = {},
): Float32Array {
  const fftSize = opts.fftSize ?? 8192
  const hopSize = opts.hopSize ?? fftSize / 2
  const minFreq = opts.minFreq ?? 65
  const maxFreq = opts.maxFreq ?? 2100

  const analyzer = new SpectrumAnalyzer(fftSize)
  const window = hannWindow(fftSize)
  const windowed = new Float32Array(fftSize)
  const spectrum = new Float32Array(fftSize / 2)
  const chroma = new Float32Array(12)

  // Precompute bin → pitch class (skip out-of-range bins).
  const binPC = new Int8Array(fftSize / 2)
  for (let k = 0; k < fftSize / 2; k++) {
    const freq = (k * sampleRate) / fftSize
    binPC[k] = freq >= minFreq && freq <= maxFreq ? freqToPitchClass(freq) : -1
  }

  for (let start = 0; start + fftSize <= signal.length; start += hopSize) {
    applyWindow(signal, start, window, windowed)
    analyzer.power(windowed, spectrum)
    for (let k = 1; k < spectrum.length; k++) {
      const pc = binPC[k]
      if (pc < 0) continue
      chroma[pc] += spectrum[k]
    }
  }

  let total = 0
  for (let i = 0; i < 12; i++) total += chroma[i]
  if (total > 0) {
    const inv = 1 / total
    for (let i = 0; i < 12; i++) chroma[i] *= inv
  }
  return chroma
}
