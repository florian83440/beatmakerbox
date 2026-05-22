// Audio file decoding helpers.
//
// Pure functions over Web Audio + typed arrays. No Vue, no DOM globals
// beyond AudioContext / OfflineAudioContext. Safe to import from any layer.

export interface DecodedAudio {
  buffer: AudioBuffer
  sampleRate: number
  durationSeconds: number
  channels: number
}

function getAudioContextCtor(): typeof AudioContext {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) throw new Error('Web Audio API is not supported in this browser.')
  return Ctor
}

/**
 * Decode an audio file (mp3, wav, flac, ogg, m4a, aac — browser-dependent)
 * into an AudioBuffer. Throws on unsupported or corrupted files.
 *
 * The temporary AudioContext is closed before returning so we don't leak
 * audio devices on the user's machine.
 */
export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer()
  const Ctor = getAudioContextCtor()
  const ctx = new Ctor()
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer)
    return {
      buffer,
      sampleRate: buffer.sampleRate,
      durationSeconds: buffer.duration,
      channels: buffer.numberOfChannels,
    }
  } finally {
    await ctx.close()
  }
}

/**
 * Downmix any AudioBuffer to a single mono channel by averaging.
 * Returns a *new* Float32Array — does not mutate the source.
 */
export function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    // Defensive copy — callers may mutate (windowing, etc).
    return new Float32Array(buffer.getChannelData(0))
  }
  const len = buffer.length
  const out = new Float32Array(len)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < len; i++) out[i] += data[i]
  }
  const inv = 1 / buffer.numberOfChannels
  for (let i = 0; i < len; i++) out[i] *= inv
  return out
}

/**
 * Take a centered slice of a signal. Returns the input unchanged if it's
 * already shorter than maxSeconds. Useful to cap analysis time on long
 * tracks without skewing toward intros/outros.
 */
export function sliceCenter(signal: Float32Array, sampleRate: number, maxSeconds: number): Float32Array {
  const maxSamples = Math.floor(sampleRate * maxSeconds)
  if (signal.length <= maxSamples) return signal
  const start = Math.floor((signal.length - maxSamples) / 2)
  return signal.subarray(start, start + maxSamples)
}

/**
 * Cheap linear-interpolation downsampler. NOT a proper anti-aliased
 * resampler — but for BPM/key analysis where we just want to drop the
 * high band, it's plenty (and fast).
 */
export function downsampleMono(signal: Float32Array, srcRate: number, dstRate: number): Float32Array {
  if (dstRate >= srcRate) return signal
  const ratio = srcRate / dstRate
  const outLen = Math.floor(signal.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio
    const i0 = Math.floor(srcPos)
    const frac = srcPos - i0
    const a = signal[i0] ?? 0
    const b = signal[i0 + 1] ?? a
    out[i] = a + (b - a) * frac
  }
  return out
}
