// Minimal wrapper around fft.js to compute magnitude / power spectra
// without leaking the complex-array layout into callers.

import FFT from 'fft.js'

export class SpectrumAnalyzer {
  readonly size: number
  private readonly fft: FFT
  private readonly complex: number[]

  constructor(size: number) {
    if ((size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of two, got ${size}`)
    }
    this.size = size
    this.fft = new FFT(size)
    this.complex = this.fft.createComplexArray()
  }

  /** Squared magnitudes (power spectrum), length size/2. */
  power(input: Float32Array, out: Float32Array): void {
    if (input.length !== this.size) {
      throw new Error(`input length ${input.length} ≠ FFT size ${this.size}`)
    }
    if (out.length !== this.size / 2) {
      throw new Error(`out length ${out.length} ≠ size/2 ${this.size / 2}`)
    }
    this.fft.realTransform(this.complex, input)
    // fft.js only fills the first half; we don't need completeSpectrum to
    // compute magnitudes since spectrum is conjugate-symmetric.
    for (let k = 0; k < this.size / 2; k++) {
      const re = this.complex[2 * k]
      const im = this.complex[2 * k + 1]
      out[k] = re * re + im * im
    }
  }

  /** Magnitudes |X[k]|, length size/2. */
  magnitude(input: Float32Array, out: Float32Array): void {
    this.power(input, out)
    for (let k = 0; k < out.length; k++) out[k] = Math.sqrt(out[k])
  }
}
