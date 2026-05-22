// Reactive bridge between a File input and a decoded AudioBuffer.

import { ref, shallowRef, computed } from 'vue'
import { decodeAudioFile, toMono, type DecodedAudio } from '@beatmakerbox/dsp'

export type AudioStatus = 'idle' | 'decoding' | 'ready' | 'error'

export interface UseAudioFileOptions {
  /** Max accepted file size in MB. Default 50. */
  maxSizeMb?: number
  /** Accept regex (matches filename). Default /\.(mp3|wav|flac|ogg|m4a|aac)$/i. */
  acceptPattern?: RegExp
}

export function useAudioFile(opts: UseAudioFileOptions = {}) {
  const maxSizeMb = opts.maxSizeMb ?? 50
  const acceptPattern = opts.acceptPattern ?? /\.(mp3|wav|flac|ogg|m4a|aac)$/i

  const status = ref<AudioStatus>('idle')
  const error = ref<string | null>(null)
  const file = shallowRef<File | null>(null)
  const decoded = shallowRef<DecodedAudio | null>(null)
  const monoSignal = shallowRef<Float32Array | null>(null)

  const fileName = computed(() => file.value?.name ?? null)
  const isReady = computed(() => status.value === 'ready' && decoded.value !== null)
  const isBusy = computed(() => status.value === 'decoding')

  async function load(input: File): Promise<DecodedAudio | null> {
    error.value = null
    if (!input.type.startsWith('audio/') && !acceptPattern.test(input.name)) {
      error.value = 'Unrecognized format. Use an audio file (mp3, wav, flac, ogg, m4a, aac).'
      status.value = 'error'
      return null
    }
    if (input.size > maxSizeMb * 1024 * 1024) {
      error.value = `File too large (max ${maxSizeMb} MB).`
      status.value = 'error'
      return null
    }

    file.value = input
    status.value = 'decoding'
    try {
      const result = await decodeAudioFile(input)
      decoded.value = result
      monoSignal.value = toMono(result.buffer)
      status.value = 'ready'
      return result
    } catch (e) {
      error.value = e instanceof Error
        ? `Couldn't decode the file: ${e.message}`
        : "Couldn't decode the file."
      status.value = 'error'
      return null
    }
  }

  function reset(): void {
    status.value = 'idle'
    error.value = null
    file.value = null
    decoded.value = null
    monoSignal.value = null
  }

  return {
    status,
    error,
    file,
    fileName,
    decoded,
    monoSignal,
    isReady,
    isBusy,
    load,
    reset,
  }
}
