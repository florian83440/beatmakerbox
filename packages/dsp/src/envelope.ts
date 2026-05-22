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

export interface OnsetSlice {
  /** Start time in seconds. */
  startSeconds: number
  /** Duration in seconds (until next onset or end of signal). */
  durationSeconds: number
}

export interface DetectOnsetsOptions {
  fftSize?: number
  hopSize?: number
  /** Minimum gap between two onsets in seconds (avoids double-triggers). Default 0.08. */
  minGapSeconds?: number
  /** Threshold multiplier over the local mean. Default 1.3. */
  thresholdMultiplier?: number
  /** Local mean window (in onset-function frames) for adaptive threshold. Default 20. */
  localWindow?: number
  /** Maximum number of slices to return. Default 64. */
  maxSlices?: number
}

/**
 * Detect onset positions in a mono signal and return time slices.
 *
 * Uses the same spectral-flux onset function as the BPM pipeline, then picks
 * peaks that exceed a local adaptive threshold with a minimum refractory gap.
 *
 * Returns an array of {startSeconds, durationSeconds} slices (always at least
 * one slice covering the whole signal). Slices are sorted by startSeconds.
 */
export function detectOnsets(
  signal: Float32Array,
  sampleRate: number,
  opts: DetectOnsetsOptions = {},
): OnsetSlice[] {
  const {
    fftSize = 1024,
    hopSize = 512,
    minGapSeconds = 0.08,
    thresholdMultiplier = 1.3,
    localWindow = 20,
    maxSlices = 64,
  } = opts

  const onset = spectralFlux(signal, sampleRate, { fftSize, hopSize })
  const flux = onset.values
  const onsetRate = onset.sampleRate // frames per second
  const minGapFrames = Math.max(1, Math.round(minGapSeconds * onsetRate))
  const totalSeconds = signal.length / sampleRate

  // Adaptive threshold: local mean × multiplier, with a half-window look-ahead/back.
  const half = Math.floor(localWindow / 2)
  const picks: number[] = [] // onset frame indices
  let lastPick = -minGapFrames

  for (let i = 1; i < flux.length - 1; i++) {
    // Local mean in [i-half, i+half]
    const lo = Math.max(0, i - half)
    const hi = Math.min(flux.length - 1, i + half)
    let localMean = 0
    for (let j = lo; j <= hi; j++) localMean += flux[j]
    localMean /= hi - lo + 1

    const threshold = localMean * thresholdMultiplier
    const isLocalPeak = flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]

    if (isLocalPeak && flux[i] > threshold && i - lastPick >= minGapFrames) {
      picks.push(i)
      lastPick = i
    }
  }

  // Convert frame indices to onset times (in seconds).
  const onsetTimes: number[] = picks.map((frame) => frame / onsetRate)

  // Always include time 0. Deduplicate times closer than minGapSeconds.
  const times: number[] = [0]
  for (const t of onsetTimes) {
    if (t - times[times.length - 1] >= minGapSeconds && t < totalSeconds - 0.05) {
      times.push(t)
    }
  }

  // Cap to maxSlices start times (keeping time 0).
  const capped = times.slice(0, maxSlices)

  // Build slices.
  const slices: OnsetSlice[] = capped.map((start, i) => {
    const next = i + 1 < capped.length ? capped[i + 1] : totalSeconds
    return { startSeconds: start, durationSeconds: next - start }
  })

  return slices.length > 0 ? slices : [{ startSeconds: 0, durationSeconds: totalSeconds }]
}
