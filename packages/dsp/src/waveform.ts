// Waveform peak extraction for compact visualization.

/**
 * Reduce a long signal to `targetSamples` min/max pairs — one per
 * horizontal pixel of the canvas. For each block, returns both the
 * maximum positive and maximum negative excursion so you can draw a
 * symmetric waveform without losing the silhouette.
 */
export interface WaveformPeaks {
  /** Positive peak per block, in [0, 1]. */
  pos: Float32Array
  /** Negative peak per block, in [-1, 0]. */
  neg: Float32Array
  /** Number of source samples that fed each peak (constant across blocks). */
  blockSize: number
}

export function extractWaveform(signal: Float32Array, targetSamples: number): WaveformPeaks {
  const target = Math.max(1, targetSamples)
  const blockSize = Math.max(1, Math.floor(signal.length / target))
  const pos = new Float32Array(target)
  const neg = new Float32Array(target)
  for (let i = 0; i < target; i++) {
    const start = i * blockSize
    const end = i === target - 1 ? signal.length : start + blockSize
    let mx = 0
    let mn = 0
    for (let j = start; j < end; j++) {
      const v = signal[j]
      if (v > mx) mx = v
      else if (v < mn) mn = v
    }
    pos[i] = mx
    neg[i] = mn
  }
  return { pos, neg, blockSize }
}
