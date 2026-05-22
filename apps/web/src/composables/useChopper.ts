// Sample chopper — slice a loop into N equal pieces, audition them,
// arrange a pattern, render the pattern to a WAV.
//
// Playback uses one AudioBufferSourceNode per scheduled slice (sources
// are single-use in Web Audio). The pattern loop reschedules itself
// slightly before each iteration ends to avoid audible gaps.

import { ref, shallowRef, computed, onBeforeUnmount } from 'vue'
import { decodeAudioFile, audioBufferToWav, downloadBlob, type DecodedAudio } from '@beatmakerbox/dsp'

export interface ChopperSlice {
  index: number
  startSeconds: number
  durationSeconds: number
}

export interface PatternStep {
  /** Stable ID — allows the same slice index to appear multiple times. */
  id: string
  /** Which slice (index into slices.value) this step plays. */
  sliceIndex: number
}

export const SLICE_COUNT_OPTIONS = [4, 8, 16, 32, 64] as const
export type SliceCount = typeof SLICE_COUNT_OPTIONS[number]

function uid(): string {
  // crypto.randomUUID() is fine in modern browsers; fallback for old ones.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useChopper() {
  const fileName = ref<string | null>(null)
  const decoded = shallowRef<DecodedAudio | null>(null)
  const error = ref<string | null>(null)
  const isDecoding = ref(false)
  const sliceCount = ref<SliceCount>(16)
  const pattern = ref<PatternStep[]>([])
  const auditioningSlice = ref<number | null>(null)
  const isPlayingPattern = ref(false)
  const isLooping = ref(true)
  const playheadStep = ref<number>(-1)
  const isExporting = ref(false)

  let ctx: AudioContext | null = null
  let activeSources: AudioBufferSourceNode[] = []
  let loopTimerHandle: number | null = null
  let playheadTimerHandle: number | null = null

  const slices = computed<ChopperSlice[]>(() => {
    if (!decoded.value) return []
    const total = decoded.value.durationSeconds
    const n = sliceCount.value
    const each = total / n
    return Array.from({ length: n }, (_, i) => ({
      index: i,
      startSeconds: i * each,
      durationSeconds: each,
    }))
  })

  const isLoaded = computed(() => decoded.value !== null)
  const patternDurationSeconds = computed(() => {
    if (!decoded.value) return 0
    let sum = 0
    for (const step of pattern.value) {
      const slice = slices.value[step.sliceIndex]
      if (slice) sum += slice.durationSeconds
    }
    return sum
  })

  function ensureCtx(): AudioContext {
    if (!ctx) {
      const Ctor = (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      ctx = new Ctor()
    }
    return ctx
  }

  async function load(file: File): Promise<void> {
    stopAll()
    error.value = null
    fileName.value = file.name
    isDecoding.value = true
    try {
      const d = await decodeAudioFile(file)
      decoded.value = d
      pattern.value = []
      playheadStep.value = -1
    } catch (e) {
      error.value = e instanceof Error
        ? `Couldn't decode the file: ${e.message}`
        : "Couldn't decode the file."
      decoded.value = null
    } finally {
      isDecoding.value = false
    }
  }

  function setSliceCount(n: SliceCount): void {
    sliceCount.value = n
    // Drop any pattern entries that point past the new slice range.
    pattern.value = pattern.value.filter((s) => s.sliceIndex < n)
  }

  async function auditionSlice(index: number): Promise<void> {
    stopAll()
    const buf = decoded.value?.buffer
    if (!buf) return
    const slice = slices.value[index]
    if (!slice) return
    const c = ensureCtx()
    if (c.state === 'suspended') await c.resume()
    const src = c.createBufferSource()
    src.buffer = buf
    src.connect(c.destination)
    src.start(0, slice.startSeconds, slice.durationSeconds)
    activeSources.push(src)
    auditioningSlice.value = index
    src.onended = () => {
      activeSources = activeSources.filter((s) => s !== src)
      if (auditioningSlice.value === index) auditioningSlice.value = null
    }
  }

  function addStep(sliceIndex: number): void {
    pattern.value = [...pattern.value, { id: uid(), sliceIndex }]
  }

  function removeStep(stepId: string): void {
    pattern.value = pattern.value.filter((s) => s.id !== stepId)
  }

  function moveStep(fromIdx: number, toIdx: number): void {
    if (fromIdx === toIdx) return
    if (fromIdx < 0 || fromIdx >= pattern.value.length) return
    const clamped = Math.max(0, Math.min(pattern.value.length - 1, toIdx))
    const next = [...pattern.value]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(clamped, 0, moved)
    pattern.value = next
  }

  function clearPattern(): void {
    pattern.value = []
    playheadStep.value = -1
  }

  function scheduleOnePass(startAt: number): { endTime: number; durations: number[] } {
    const buf = decoded.value?.buffer
    if (!buf) return { endTime: startAt, durations: [] }
    const c = ensureCtx()
    let t = startAt
    const durations: number[] = []
    for (const step of pattern.value) {
      const slice = slices.value[step.sliceIndex]
      if (!slice) continue
      const src = c.createBufferSource()
      src.buffer = buf
      src.connect(c.destination)
      src.start(t, slice.startSeconds, slice.durationSeconds)
      activeSources.push(src)
      src.onended = () => {
        activeSources = activeSources.filter((s) => s !== src)
      }
      durations.push(slice.durationSeconds)
      t += slice.durationSeconds
    }
    return { endTime: t, durations }
  }

  async function playPattern(): Promise<void> {
    stopAll()
    if (!decoded.value || pattern.value.length === 0) return
    const c = ensureCtx()
    if (c.state === 'suspended') await c.resume()

    const passStart = c.currentTime + 0.05
    let nextPassStart = scheduleOnePass(passStart).endTime
    isPlayingPattern.value = true
    playheadStep.value = -1

    if (isLooping.value) {
      // Re-schedule a fresh pass whenever the current one is about to end.
      loopTimerHandle = window.setInterval(() => {
        if (!ctx || !isPlayingPattern.value) return
        if (ctx.currentTime > nextPassStart - 0.15) {
          nextPassStart = scheduleOnePass(nextPassStart).endTime
        }
      }, 60)
    } else {
      // One-shot: stop after the pass finishes.
      const totalDur = patternDurationSeconds.value
      window.setTimeout(() => stopAll(), totalDur * 1000 + 100)
    }

    // Drive the visual playhead by checking which step is currently audible.
    const totalDur = patternDurationSeconds.value
    if (totalDur > 0) {
      const startedAt = passStart
      const stepStarts: number[] = []
      let acc = 0
      for (const step of pattern.value) {
        const slice = slices.value[step.sliceIndex]
        if (!slice) { stepStarts.push(acc); continue }
        stepStarts.push(acc)
        acc += slice.durationSeconds
      }
      playheadTimerHandle = window.setInterval(() => {
        if (!ctx || !isPlayingPattern.value) return
        const elapsed = (ctx.currentTime - startedAt + totalDur) % totalDur
        let idx = -1
        for (let i = 0; i < stepStarts.length; i++) {
          if (elapsed >= stepStarts[i]) idx = i
          else break
        }
        playheadStep.value = idx
      }, 30)
    }
  }

  function stopAll(): void {
    for (const src of activeSources) {
      try { src.stop() } catch { /* noop */ }
    }
    activeSources = []
    if (loopTimerHandle !== null) {
      clearInterval(loopTimerHandle)
      loopTimerHandle = null
    }
    if (playheadTimerHandle !== null) {
      clearInterval(playheadTimerHandle)
      playheadTimerHandle = null
    }
    auditioningSlice.value = null
    isPlayingPattern.value = false
    playheadStep.value = -1
  }

  async function exportPatternWav(): Promise<void> {
    if (!decoded.value || pattern.value.length === 0) return
    isExporting.value = true
    try {
      const sourceBuf = decoded.value.buffer
      const sampleRate = decoded.value.sampleRate
      const numChannels = sourceBuf.numberOfChannels
      const totalSamples = Math.max(1, Math.ceil(patternDurationSeconds.value * sampleRate))

      const offline = new OfflineAudioContext(numChannels, totalSamples, sampleRate)
      let t = 0
      for (const step of pattern.value) {
        const slice = slices.value[step.sliceIndex]
        if (!slice) continue
        const src = offline.createBufferSource()
        src.buffer = sourceBuf
        src.connect(offline.destination)
        src.start(t, slice.startSeconds, slice.durationSeconds)
        t += slice.durationSeconds
      }
      const rendered = await offline.startRendering()
      const wav = audioBufferToWav(rendered)
      const base = fileName.value?.replace(/\.[^.]+$/, '') ?? 'chop'
      downloadBlob(wav, `${base}-pattern.wav`)
    } finally {
      isExporting.value = false
    }
  }

  function reset(): void {
    stopAll()
    decoded.value = null
    fileName.value = null
    pattern.value = []
    error.value = null
  }

  onBeforeUnmount(() => {
    stopAll()
    if (ctx) {
      ctx.close().catch(() => {})
      ctx = null
    }
  })

  return {
    fileName,
    decoded,
    error,
    isDecoding,
    isLoaded,
    sliceCount,
    slices,
    pattern,
    patternDurationSeconds,
    auditioningSlice,
    isPlayingPattern,
    isLooping,
    isExporting,
    playheadStep,
    load,
    reset,
    setSliceCount,
    auditionSlice,
    addStep,
    removeStep,
    moveStep,
    clearPattern,
    playPattern,
    stopAll,
    exportPatternWav,
  }
}
