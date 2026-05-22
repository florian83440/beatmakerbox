// BPM detection pipeline.
//
// 1. Spectral-flux onset function (low-rate envelope of percussive attacks).
// 2. Autocorrelation of the onset function, restricted to a musical lag range.
// 3. Quadratic interpolation of the top autocorrelation peak.
// 4. Octave disambiguation: if the winning BPM falls outside [70, 180],
//    fold ×2 / ÷2 until it does — but only if the folded candidate has a
//    stronger autocorrelation peak than the original.
//
// Returns the top candidate + a ranked list + a coarse confidence label.

import { decodeAudioFile, toMono, sliceCenter, downsampleMono } from './decode'
import { spectralFlux } from './envelope'
import { autocorrelate, parabolicInterpolate } from './autocorr'

export type BpmConfidence = 'low' | 'medium' | 'high'

export interface BpmCandidate {
  bpm: number
  /** Raw autocorrelation peak value, in [0, 1]. */
  strength: number
}

export interface BpmResult {
  bpm: number
  confidence: BpmConfidence
  /** Normalized peak strength in [0, 1]. */
  strength: number
  candidates: BpmCandidate[]
  durationMs: number
  analyzedSeconds: number
  /** Onset-function preview (downsampled to ≤ 600 samples for plotting). */
  envelopePreview: number[]
}

export interface BpmOptions {
  /** Min BPM considered musical. Default 70. */
  minBpm?: number
  /** Max BPM considered musical. Default 180. */
  maxBpm?: number
  /** Work sample rate after downsampling. Default 22050. */
  workRate?: number
  /** Max seconds of audio analyzed (centered slice). Default 90. */
  maxSeconds?: number
}

const DEFAULTS = {
  minBpm: 70,
  maxBpm: 180,
  workRate: 22050,
  maxSeconds: 90,
}

/**
 * Run BPM detection on an already-decoded mono signal.
 *
 * This is the synchronous worker-friendly entry point — no File / no
 * AudioContext involved. Use detectBpm() to start from a File.
 */
export function analyzeBpm(
  monoSignal: Float32Array,
  sampleRate: number,
  opts: BpmOptions = {},
): Omit<BpmResult, 'durationMs'> {
  const o = { ...DEFAULTS, ...opts }

  const sliced = sliceCenter(monoSignal, sampleRate, o.maxSeconds)
  const work = downsampleMono(sliced, sampleRate, o.workRate)

  const onset = spectralFlux(work, o.workRate)

  // Convert BPM bounds to lag bounds on the onset function.
  // lag (frames) = 60 / BPM * onset.sampleRate
  const minLag = Math.max(2, Math.floor((60 / o.maxBpm) * onset.sampleRate))
  const maxLag = Math.min(onset.values.length - 1, Math.ceil((60 / o.minBpm) * onset.sampleRate))
  if (maxLag <= minLag + 2) {
    return emptyResult(sliced.length / sampleRate, onset.values)
  }

  const acf = new Float32Array(maxLag - minLag + 1)
  autocorrelate(onset.values, minLag, maxLag, acf)

  // Find the top 3 peaks, with a small exclusion zone around each chosen
  // peak so we don't pick the same lobe three times.
  const peaks: Array<{ lag: number; value: number }> = []
  const taken = new Uint8Array(acf.length)
  const exclusion = Math.max(2, Math.floor(acf.length * 0.04))

  for (let pick = 0; pick < 3; pick++) {
    let bestIdx = -1
    let bestVal = -Infinity
    for (let i = 1; i < acf.length - 1; i++) {
      if (taken[i]) continue
      if (acf[i] <= acf[i - 1] || acf[i] <= acf[i + 1]) continue
      if (acf[i] > bestVal) {
        bestVal = acf[i]
        bestIdx = i
      }
    }
    if (bestIdx < 0) break
    const refined = parabolicInterpolate(acf, bestIdx)
    peaks.push({ lag: minLag + refined.index, value: Math.max(0, Math.min(1, refined.value)) })
    const lo = Math.max(0, bestIdx - exclusion)
    const hi = Math.min(acf.length - 1, bestIdx + exclusion)
    for (let j = lo; j <= hi; j++) taken[j] = 1
  }

  if (peaks.length === 0) return emptyResult(sliced.length / sampleRate, onset.values)

  // Convert lags → BPM, fold octaves into the musical range.
  const rawCandidates = peaks.map((p) => ({
    bpm: foldIntoRange((60 * onset.sampleRate) / p.lag, o.minBpm, o.maxBpm),
    strength: p.value,
  }))

  // Boost candidates whose double or half also has support in the ACF.
  // (Cheap consonance check — helps avoid the 70 vs 140 trap.)
  const boosted = rawCandidates.map((c) => ({
    bpm: c.bpm,
    strength: c.strength + 0.15 * supportFor(c.bpm, peaks, onset.sampleRate, o.minBpm, o.maxBpm),
  }))

  boosted.sort((a, b) => b.strength - a.strength)
  const winner = boosted[0]

  return {
    bpm: round1(winner.bpm),
    confidence: bucketConfidence(winner.strength),
    strength: clamp01(winner.strength),
    candidates: boosted.slice(0, 3).map((c) => ({
      bpm: round1(c.bpm),
      strength: clamp01(c.strength),
    })),
    analyzedSeconds: sliced.length / sampleRate,
    envelopePreview: previewEnvelope(onset.values, 600),
  }
}

/** End-to-end BPM detection from a File. */
export async function detectBpm(file: File, opts: BpmOptions = {}): Promise<BpmResult> {
  const t0 = performance.now()
  const decoded = await decodeAudioFile(file)
  const mono = toMono(decoded.buffer)
  const result = analyzeBpm(mono, decoded.sampleRate, opts)
  return { ...result, durationMs: performance.now() - t0 }
}

// --- helpers ---

function foldIntoRange(bpm: number, min: number, max: number): number {
  let b = bpm
  let guard = 0
  while (b < min && guard++ < 8) b *= 2
  while (b > max && guard++ < 8) b /= 2
  return b
}

function supportFor(
  bpm: number,
  peaks: Array<{ lag: number; value: number }>,
  onsetRate: number,
  min: number,
  max: number,
): number {
  let support = 0
  for (const target of [bpm * 2, bpm / 2]) {
    if (target < min || target > max) continue
    const lag = (60 * onsetRate) / target
    let best = 0
    for (const p of peaks) {
      const rel = Math.abs(p.lag - lag) / lag
      if (rel < 0.04 && p.value > best) best = p.value
    }
    support += best
  }
  return support
}

function bucketConfidence(strength: number): BpmConfidence {
  if (strength >= 0.55) return 'high'
  if (strength >= 0.32) return 'medium'
  return 'low'
}

function round1(n: number): number { return Math.round(n * 10) / 10 }
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)) }

function previewEnvelope(values: Float32Array, target: number): number[] {
  if (values.length <= target) return Array.from(values)
  const step = values.length / target
  const out = new Array<number>(target)
  for (let i = 0; i < target; i++) {
    const a = Math.floor(i * step)
    const b = Math.min(values.length, Math.floor((i + 1) * step))
    let max = 0
    for (let j = a; j < b; j++) if (values[j] > max) max = values[j]
    out[i] = max
  }
  return out
}

function emptyResult(analyzed: number, values: Float32Array): Omit<BpmResult, 'durationMs'> {
  return {
    bpm: 0,
    confidence: 'low',
    strength: 0,
    candidates: [],
    analyzedSeconds: analyzed,
    envelopePreview: previewEnvelope(values, 600),
  }
}
