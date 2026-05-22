// Pitch / note utilities.

export const NOTES: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

const A4_FREQ = 440
const A4_MIDI = 69

/** Frequency → pitch class (0..11, C=0). Returns -1 if freq ≤ 0. */
export function freqToPitchClass(freq: number): number {
  if (freq <= 0) return -1
  const midi = A4_MIDI + 12 * Math.log2(freq / A4_FREQ)
  return ((Math.round(midi) % 12) + 12) % 12
}

/** Frequency → MIDI note number (float, not rounded). */
export function freqToMidi(freq: number): number {
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ)
}

/** MIDI note number → frequency in Hz. */
export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12)
}

/** Cents deviation between a measured freq and the nearest semitone. */
export function centsDeviation(freq: number): number {
  const midi = freqToMidi(freq)
  return Math.round(1200 * Math.log2(freq / midiToFreq(Math.round(midi))))
}
