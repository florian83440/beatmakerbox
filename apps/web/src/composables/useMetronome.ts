// Sample-accurate metronome built on the look-ahead scheduling pattern.
//
// Two clocks:
//  - setInterval (~25 ms) wakes up a scheduler that peeks ahead in the
//    AudioContext clock and queues every click that falls within a short
//    look-ahead window (100 ms).
//  - Each click is then scheduled at a precise audio time via
//    oscillator.start(time) — the audio thread plays it sample-accurately.
//
// This decouples UI/timer jitter from the audible beat timing.
// Reference pattern: Chris Wilson, "A Tale of Two Clocks".

import { ref, onBeforeUnmount } from 'vue'

export type Subdivision = 1 | 2 | 3 | 4

export interface MetronomeOptions {
  bpm?: number
  beatsPerBar?: number
  subdivision?: Subdivision
  accent?: boolean
  /** Tone for accented beat 1 (Hz). Default 1500. */
  accentFreq?: number
  /** Tone for downbeats (Hz). Default 1000. */
  beatFreq?: number
  /** Tone for subdivisions between beats (Hz). Default 800. */
  subFreq?: number
}

const SCHEDULER_INTERVAL_MS = 25
const SCHEDULE_LOOKAHEAD_S = 0.1
const NOTE_DURATION_S = 0.06

export function useMetronome(opts: MetronomeOptions = {}) {
  const bpm = ref(opts.bpm ?? 100)
  const beatsPerBar = ref(opts.beatsPerBar ?? 4)
  const subdivision = ref<Subdivision>(opts.subdivision ?? 1)
  const accent = ref(opts.accent ?? true)

  const isPlaying = ref(false)
  const currentBeat = ref(-1)        // 0..beatsPerBar-1 (-1 when stopped)
  const currentSubBeat = ref(-1)     // 0..subdivision-1

  const ACCENT_FREQ = opts.accentFreq ?? 1500
  const BEAT_FREQ = opts.beatFreq ?? 1000
  const SUB_FREQ = opts.subFreq ?? 800

  let ctx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let schedulerHandle: number | null = null
  let rafId: number | null = null

  let nextNoteTime = 0
  let stepCounter = 0
  const visualQueue: Array<{ time: number; beat: number; sub: number }> = []

  function ensureContext(): AudioContext {
    if (!ctx) {
      const Ctor = (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      ctx = new Ctor()
      masterGain = ctx.createGain()
      masterGain.gain.value = 0.7
      masterGain.connect(ctx.destination)
    }
    return ctx
  }

  function scheduleClick(time: number, isAccent: boolean, isMainBeat: boolean): void {
    const c = ensureContext()
    if (!masterGain) return

    let freq: number
    let level: number
    if (isAccent) { freq = ACCENT_FREQ; level = 0.55 }
    else if (isMainBeat) { freq = BEAT_FREQ; level = 0.45 }
    else { freq = SUB_FREQ; level = 0.22 }

    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = 'square'
    osc.frequency.value = freq

    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(level, time + 0.001)
    env.gain.exponentialRampToValueAtTime(0.0001, time + NOTE_DURATION_S)

    osc.connect(env)
    env.connect(masterGain)
    osc.start(time)
    osc.stop(time + NOTE_DURATION_S + 0.02)
  }

  function schedulerTick(): void {
    if (!ctx || !isPlaying.value) return
    const sub = subdivision.value
    const secondsPerStep = 60 / bpm.value / sub
    const horizon = ctx.currentTime + SCHEDULE_LOOKAHEAD_S

    while (nextNoteTime < horizon) {
      const beatInBar = Math.floor(stepCounter / sub) % beatsPerBar.value
      const subInBeat = stepCounter % sub
      const isMainBeat = subInBeat === 0
      const isAccent = accent.value && isMainBeat && beatInBar === 0

      scheduleClick(nextNoteTime, isAccent, isMainBeat)
      visualQueue.push({ time: nextNoteTime, beat: beatInBar, sub: subInBeat })

      nextNoteTime += secondsPerStep
      stepCounter++
    }
  }

  function visualLoop(): void {
    if (!ctx) { rafId = null; return }
    const now = ctx.currentTime
    while (visualQueue.length > 0 && visualQueue[0].time <= now) {
      const item = visualQueue.shift()!
      currentBeat.value = item.beat
      currentSubBeat.value = item.sub
    }
    if (isPlaying.value) {
      rafId = requestAnimationFrame(visualLoop)
    } else {
      rafId = null
    }
  }

  async function start(): Promise<void> {
    const c = ensureContext()
    if (c.state === 'suspended') await c.resume()
    nextNoteTime = c.currentTime + 0.05
    stepCounter = 0
    visualQueue.length = 0
    currentBeat.value = -1
    currentSubBeat.value = -1
    isPlaying.value = true
    schedulerHandle = window.setInterval(schedulerTick, SCHEDULER_INTERVAL_MS)
    rafId = requestAnimationFrame(visualLoop)
  }

  function stop(): void {
    isPlaying.value = false
    if (schedulerHandle !== null) {
      clearInterval(schedulerHandle)
      schedulerHandle = null
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    visualQueue.length = 0
    currentBeat.value = -1
    currentSubBeat.value = -1
  }

  async function toggle(): Promise<void> {
    if (isPlaying.value) stop()
    else await start()
  }

  function setBpm(value: number): void {
    bpm.value = Math.max(30, Math.min(300, Math.round(value)))
  }

  function setBeatsPerBar(n: number): void {
    beatsPerBar.value = Math.max(1, Math.min(12, Math.round(n)))
  }

  function setSubdivision(s: Subdivision): void {
    subdivision.value = s
  }

  onBeforeUnmount(() => {
    stop()
    if (ctx) {
      ctx.close().catch(() => {})
      ctx = null
      masterGain = null
    }
  })

  return {
    bpm,
    beatsPerBar,
    subdivision,
    accent,
    isPlaying,
    currentBeat,
    currentSubBeat,
    start,
    stop,
    toggle,
    setBpm,
    setBeatsPerBar,
    setSubdivision,
  }
}
