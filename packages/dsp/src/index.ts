// @beatmakerbox/dsp — pure audio DSP helpers, no Vue, no DOM beyond AudioContext.
//
// Barrel export. Consumers can either:
//   import { detectKey } from '@beatmakerbox/dsp'
// or, to keep tree-shaking obvious:
//   import { detectKey } from '@beatmakerbox/dsp/key'

export * from './decode'
export * from './windowing'
export * from './fft'
export * from './notes'
export * from './chroma'
export * from './key'
export * from './envelope'
export * from './autocorr'
export * from './bpm'
export * from './pitch'
export * from './waveform'
export * from './wavExport'
