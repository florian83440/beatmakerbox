// Onset detection function via spectral flux.
//
// Spectral flux = sum of half-wave-rectified differences between consecutive
// magnitude spectra. Spikes when energy increases in any band — i.e. on
// percussive attacks. Far more robust than raw RMS for BPM detection.

import { hannWindow, applyWindow } from './windowing'
import { SpectrumAnalyzer } from './fft'

export interface OnsetFunction {
  /** One sample per FFT hop. Already DC-removed and unit-normalized. */
  values: Float32Array
  /** Sample rate of the onset function (Hz). */
  sampleRate: number
}

export interface SpectralFluxOptions {
  fftSize?: number
  hopSize?: number
}

export function spectralFlux(
  signal: Float32Array,
  audioSampleRate: number,
  opts: SpectralFluxOptions = {},
): OnsetFunction {
  const fftSize = opts.fftSize ?? 1024
  const hopSize = opts.hopSize ?? 512

  const analyzer = new SpectrumAnalyzer(fftSize)
  const window = hannWindow(fftSize)
  const windowed = new Float32Array(fftSize)
  const halfBins = fftSize / 2

  const magCurrent = new Float32Array(halfBins)
  const magPrev = new Float32Array(halfBins)

  const frameCount = Math.max(0, Math.floor((signal.length - fftSize) / hopSize) + 1)
  const flux = new Float32Array(frameCount)

  let writeIdx = 0
  for (let start = 0; start + fftSize <= signal.length; start += hopSize) {
    applyWindow(signal, start, window, windowed)
    analyzer.magnitude(windowed, magCurrent)

    if (writeIdx > 0) {
      let sum = 0
      for (let k = 0; k < halfBins; k++) {
        const diff = magCurrent[k] - magPrev[k]
        if (diff > 0) sum += diff
      }
      flux[writeIdx] = sum
    }

    // Swap buffers (manual copy — magCurrent reused next iteration).
    magPrev.set(magCurrent)
    writeIdx++
  }

  // Remove DC and normalize to [0, 1] so autocorrelation peaks are
  // independent of input gain.
  let mean = 0
  for (let i = 0; i < flux.length; i++) mean += flux[i]
  mean /= flux.length || 1
  let max = 0
  for (let i = 0; i < flux.length; i++) {
    flux[i] = Math.max(0, flux[i] - mean)
    if (flux[i] > max) max = flux[i]
  }
  if (max > 0) {
    const inv = 1 / max
    for (let i = 0; i < flux.length; i++) flux[i] *= inv
  }

  return {
    values: flux,
    sampleRate: audioSampleRate / hopSize,
  }
}
