// Autocorrelation helpers.

/**
 * Normalized autocorrelation r(τ) for τ ∈ [minLag, maxLag] inclusive.
 * Normalization is r(0), so output is in [-1, 1].
 *
 * Out array length must be (maxLag - minLag + 1).
 */
export function autocorrelate(
  signal: Float32Array,
  minLag: number,
  maxLag: number,
  out: Float32Array,
): void {
  const expectedLen = maxLag - minLag + 1
  if (out.length !== expectedLen) {
    throw new Error(`out length ${out.length} ≠ expected ${expectedLen}`)
  }

  let r0 = 0
  for (let i = 0; i < signal.length; i++) r0 += signal[i] * signal[i]
  const invR0 = r0 > 0 ? 1 / r0 : 0

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    const upper = signal.length - lag
    for (let i = 0; i < upper; i++) sum += signal[i] * signal[i + lag]
    out[lag - minLag] = sum * invR0
  }
}

export interface ParabolicPeak {
  /** Sub-sample peak position (fractional index, relative to array start). */
  index: number
  /** Interpolated peak value. */
  value: number
}

/**
 * Quadratic interpolation around an integer peak `i`, using its neighbors.
 * Returns the refined sub-sample peak. Falls back to integer peak at the
 * boundaries.
 */
export function parabolicInterpolate(values: ArrayLike<number>, i: number): ParabolicPeak {
  if (i <= 0 || i >= values.length - 1) {
    return { index: i, value: values[i] }
  }
  const y0 = values[i - 1]
  const y1 = values[i]
  const y2 = values[i + 1]
  const denom = y0 - 2 * y1 + y2
  if (denom === 0) return { index: i, value: y1 }
  const delta = 0.5 * (y0 - y2) / denom
  return {
    index: i + delta,
    value: y1 - 0.25 * (y0 - y2) * delta,
  }
}
