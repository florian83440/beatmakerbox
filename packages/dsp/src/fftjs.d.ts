declare module 'fft.js' {
  // fft.js returns a plain number[] (length size*2) from createComplexArray.
  // We type the buffer as a numeric ArrayLike so callers can index into it
  // without committing to Float64Array specifically.
  type ComplexBuffer = number[]

  export default class FFT {
    constructor(size: number)
    size: number
    createComplexArray(): ComplexBuffer
    fromComplexArray(complex: ArrayLike<number>, storage?: ComplexBuffer): ComplexBuffer
    toComplexArray(input: ArrayLike<number>, storage?: ComplexBuffer): ComplexBuffer
    completeSpectrum(spectrum: ComplexBuffer): void
    transform(out: ComplexBuffer, data: ArrayLike<number>): void
    realTransform(out: ComplexBuffer, data: ArrayLike<number>): void
    inverseTransform(out: ComplexBuffer, data: ArrayLike<number>): void
  }
}
