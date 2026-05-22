// Key estimation via Krumhansl-Schmuckler profile correlation.

import { decodeAudioFile, toMono, sliceCenter } from './decode'
import { computeChromagram } from './chroma'
import { NOTES } from './notes'

export type Mode = 'major' | 'minor'

export interface KeyResult {
  /** Human-readable label, e.g. "F# minor". */
  key: string
  tonic: string
  mode: Mode
  /** Pearson correlation with the winning profile, clamped to [0, 1]. */
  confidence: number
  alternatives: Array<{ key: string; confidence: number }>
  /** Camelot wheel code (e.g. "8B"). Empty string if unmapped. */
  camelot: string
  /** 12-bin normalized chromagram, for visualization. */
  chromagram: number[]
  /** Time spent (ms) inside detectKey, end-to-end. */
  durationMs: number
  /** Seconds of audio actually analyzed (≤ source duration). */
  analyzedSeconds: number
}

// Krumhansl-Kessler key profiles (Krumhansl & Kessler, 1982).
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

const CAMELOT: Record<string, string> = {
  'C major': '8B',   'A minor': '8A',
  'G major': '9B',   'E minor': '9A',
  'D major': '10B',  'B minor': '10A',
  'A major': '11B',  'F# minor': '11A',
  'E major': '12B',  'C# minor': '12A',
  'B major': '1B',   'G# minor': '1A',
  'F# major': '2B',  'D# minor': '2A',
  'C# major': '3B',  'A# minor': '3A',
  'G# major': '4B',  'F minor': '4A',
  'D# major': '5B',  'C minor': '5A',
  'A# major': '6B',  'G minor': '6A',
  'F major': '7B',   'D minor': '7A',
}

const MAX_ANALYSIS_SECONDS = 60

function pearson(x: ArrayLike<number>, y: ArrayLike<number>, n: number): number {
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i] }
  const mx = sx / n
  const my = sy / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const den = Math.sqrt(dx2 * dy2)
  return den === 0 ? 0 : num / den
}

/**
 * Match a chromagram against all 24 rotated Krumhansl-Kessler profiles
 * and return ranked candidates.
 */
export function estimateKey(chroma: Float32Array): Omit<KeyResult, 'durationMs' | 'analyzedSeconds'> {
  const rotated = new Float32Array(12)
  const candidates: Array<{ key: string; tonic: string; mode: Mode; corr: number }> = []

  for (let tonic = 0; tonic < 12; tonic++) {
    for (let i = 0; i < 12; i++) rotated[i] = KK_MAJOR[(i - tonic + 12) % 12]
    candidates.push({
      tonic: NOTES[tonic],
      mode: 'major',
      key: `${NOTES[tonic]} major`,
      corr: pearson(chroma, rotated, 12),
    })
    for (let i = 0; i < 12; i++) rotated[i] = KK_MINOR[(i - tonic + 12) % 12]
    candidates.push({
      tonic: NOTES[tonic],
      mode: 'minor',
      key: `${NOTES[tonic]} minor`,
      corr: pearson(chroma, rotated, 12),
    })
  }

  candidates.sort((a, b) => b.corr - a.corr)
  const best = candidates[0]

  return {
    key: best.key,
    tonic: best.tonic,
    mode: best.mode,
    confidence: Math.max(0, best.corr),
    alternatives: candidates.slice(1, 4).map((c) => ({
      key: c.key,
      confidence: Math.max(0, c.corr),
    })),
    camelot: CAMELOT[`${best.tonic} ${best.mode}`] ?? '',
    chromagram: Array.from(chroma),
  }
}

/** End-to-end key detection from a file. */
export async function detectKey(file: File): Promise<KeyResult> {
  const t0 = performance.now()
  const decoded = await decodeAudioFile(file)
  const mono = toMono(decoded.buffer)
  const sliced = sliceCenter(mono, decoded.sampleRate, MAX_ANALYSIS_SECONDS)
  const chroma = computeChromagram(sliced, decoded.sampleRate)
  const result = estimateKey(chroma)
  return {
    ...result,
    durationMs: performance.now() - t0,
    analyzedSeconds: sliced.length / decoded.sampleRate,
  }
}
