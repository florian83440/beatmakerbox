// Windowing helpers — Hann window for spectral analysis, frame iteration.

let hannCache: Map<number, Float32Array> = new Map()

/**
 * Return a Hann window of `size` samples. Cached per size — the same
 * window is reused across many calls.
 */
export function hannWindow(size: number): Float32Array {
  const cached = hannCache.get(size)
  if (cached) return cached
  const w = new Float32Array(size)
  const denom = size - 1
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom))
  }
  hannCache.set(size, w)
  return w
}

export function clearHannCache(): void {
  hannCache = new Map()
}

/**
 * Apply a window in-place: out[i] = signal[start + i] * window[i].
 * `out` must already be allocated to `window.length` samples.
 */
export function applyWindow(
  signal: Float32Array,
  start: number,
  window: Float32Array,
  out: Float32Array,
): void {
  const len = window.length
  for (let i = 0; i < len; i++) {
    out[i] = signal[start + i] * window[i]
  }
}
