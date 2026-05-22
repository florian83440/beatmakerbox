// Monophonic pitch detection via YIN.
//
// YIN (de Cheveigné & Kawahara, 2002) is robust against the classic
// autocorrelation octave errors and works well on sustained tones such as
// 808 sub-bass, single-note vocal phrases, etc. It does not work on
// polyphonic material — for chords / mixes you'd want a different approach.

export interface PitchResult {
  /** Detected fundamental frequency in Hz. 0 if no confident result. */
  frequency: number
  /**
   * Clarity / confidence in [0, 1]. Above ~0.85 the result is solid;
   * below ~0.5 the algorithm is grasping.
   */
  clarity: number
}

export interface YinOptions {
  /** Absolute threshold on the cumulative mean normalized difference. Default 0.15. */
  threshold?: number
  /** Lower bound for the searched fundamental (Hz). Default 50. */
  minFreq?: number
  /** Upper bound for the searched fundamental (Hz). Default 2000. */
  maxFreq?: number
}

/**
 * Run YIN on a windowed signal and return the most likely fundamental.
 */
export function detectPitchYin(
  signal: Float32Array,
  sampleRate: number,
  options: YinOptions = {},
): PitchResult {
  const threshold = options.threshold ?? 0.15
  const minFreq = options.minFreq ?? 50
  const maxFreq = options.maxFreq ?? 2000

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq))
  const maxLag = Math.min(
    Math.floor(signal.length / 2),
    Math.floor(sampleRate / minFreq),
  )
  if (maxLag <= minLag + 2) return { frequency: 0, clarity: 0 }

  // Step 1 — difference function d(τ) = Σ (x[i] - x[i+τ])²
  const diff = new Float32Array(maxLag + 1)
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0
    const upper = signal.length - tau
    for (let i = 0; i < upper; i++) {
      const delta = signal[i] - signal[i + tau]
      sum += delta * delta
    }
    diff[tau] = sum
  }

  // Step 2 — cumulative mean normalized difference function (CMNDF)
  const cmnd = new Float32Array(maxLag + 1)
  cmnd[0] = 1
  let runningSum = 0
  for (let tau = 1; tau <= maxLag; tau++) {
    runningSum += diff[tau]
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1
  }

  // Step 3 — find the first τ in the search range where CMNDF dips below
  // the threshold, then descend to the local minimum.
  let tauEst = -1
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= maxLag && cmnd[tau + 1] < cmnd[tau]) tau++
      tauEst = tau
      break
    }
  }

  // No τ broke threshold — fall back to the global minimum of CMNDF in the
  // search range (lower confidence).
  if (tauEst < 0) {
    let bestVal = Infinity
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmnd[tau] < bestVal) {
        bestVal = cmnd[tau]
        tauEst = tau
      }
    }
    if (tauEst < 0) return { frequency: 0, clarity: 0 }
  }

  // Step 4 — parabolic interpolation around tauEst for sub-sample precision.
  let betterTau: number
  if (tauEst > 0 && tauEst < maxLag) {
    const s0 = cmnd[tauEst - 1]
    const s1 = cmnd[tauEst]
    const s2 = cmnd[tauEst + 1]
    const denom = 2 * (2 * s1 - s2 - s0)
    betterTau = denom !== 0 ? tauEst + (s2 - s0) / denom : tauEst
  } else {
    betterTau = tauEst
  }

  const clarity = Math.max(0, Math.min(1, 1 - cmnd[tauEst]))
  return { frequency: sampleRate / betterTau, clarity }
}

// ---- file-level pitch detection ----------------------------------------

import { decodeAudioFile, toMono } from './decode'
import { freqToMidi, midiToFreq, NOTES } from './notes'

export interface NoteDetectionResult {
  detected: boolean
  /** Fundamental in Hz. */
  frequency: number
  /** Nearest MIDI note number. */
  midi: number
  /** Note name (without octave), e.g. "C#". */
  noteName: string
  /** Octave number (C4 = middle C). */
  octave: number
  /** Cents deviation from the nearest equal-tempered note (-50..+50). */
  cents: number
  /** YIN clarity in [0, 1]. */
  clarity: number
  /** Wall-clock duration of detectNote() in ms. */
  durationMs: number
  /** Seconds of audio actually analyzed. */
  analyzedSeconds: number
}

/**
 * Detect the fundamental note of a (mostly monophonic) one-shot or sample.
 *
 * Strategy: scan the first 2 seconds, skip the initial 50 ms (transient),
 * and analyze the loudest 200 ms region available. Long enough to cover ~10
 * periods at 50 Hz so YIN doesn't struggle on subs.
 */
export async function detectNote(file: File): Promise<NoteDetectionResult> {
  const t0 = performance.now()
  const decoded = await decodeAudioFile(file)
  const mono = toMono(decoded.buffer)
  const sampleRate = decoded.sampleRate

  const analysisCap = Math.min(mono.length, Math.floor(2 * sampleRate))
  const skip = Math.min(Math.floor(0.05 * sampleRate), Math.max(0, analysisCap - 1))
  const windowSize = Math.min(
    Math.floor(0.2 * sampleRate),
    Math.max(1, analysisCap - skip),
  )

  // Need at least ~2k samples for YIN to give a sensible answer.
  if (windowSize < 1024) {
    return emptyResult(t0, 0)
  }

  // Find the loudest 200 ms window after `skip` within the first 2 s.
  const stride = Math.max(1, Math.floor(0.05 * sampleRate))
  let bestEnergy = -1
  let bestStart = skip
  for (let s = skip; s + windowSize <= analysisCap; s += stride) {
    let e = 0
    for (let i = s; i < s + windowSize; i++) e += mono[i] * mono[i]
    if (e > bestEnergy) {
      bestEnergy = e
      bestStart = s
    }
  }

  const analyzed = mono.subarray(bestStart, bestStart + windowSize)
  const { frequency, clarity } = detectPitchYin(analyzed, sampleRate)

  if (frequency <= 0 || !isFinite(frequency)) {
    return emptyResult(t0, windowSize / sampleRate)
  }

  const midiFloat = freqToMidi(frequency)
  const nearestMidi = Math.round(midiFloat)
  const cents = Math.round(1200 * Math.log2(frequency / midiToFreq(nearestMidi)))
  const pitchClass = ((nearestMidi % 12) + 12) % 12
  const octave = Math.floor(nearestMidi / 12) - 1   // MIDI 60 = C4

  return {
    detected: true,
    frequency,
    midi: nearestMidi,
    noteName: NOTES[pitchClass],
    octave,
    cents,
    clarity,
    durationMs: performance.now() - t0,
    analyzedSeconds: windowSize / sampleRate,
  }
}

function emptyResult(t0: number, analyzed: number): NoteDetectionResult {
  return {
    detected: false,
    frequency: 0,
    midi: 0,
    noteName: '',
    octave: 0,
    cents: 0,
    clarity: 0,
    durationMs: performance.now() - t0,
    analyzedSeconds: analyzed,
  }
}
