// 7-band parametric EQ player with a live spectrum tap + frequency response.
//
// Graph: <audio> ─→ MediaElementSource ─→ B1 → B2 → ... → BN ─→ Analyser ─→ destination
//
// Each band is fully controllable at runtime (frequency / Q / gain) and the
// composable can return the chain's frequency response in dB for plotting.

import { ref, shallowRef, onBeforeUnmount } from 'vue'

export interface EqBandState {
  /** Filter biquad type. Shelves are typically used at the ends. */
  type: BiquadFilterType
  /** Center frequency in Hz. */
  frequency: number
  /** Q factor (only used by peaking/bandpass types). */
  q: number
  /** Gain in dB. */
  gain: number
  /** Short display label, e.g. "1 kHz". */
  label: string
}

export interface EqPreset {
  name: string
  bands: EqBandState[]
}

export const DEFAULT_BANDS: EqBandState[] = [
  { type: 'lowshelf',  frequency: 60,    q: 0.7, gain: 0, label: '60 Hz' },
  { type: 'peaking',   frequency: 150,   q: 1.0, gain: 0, label: '150 Hz' },
  { type: 'peaking',   frequency: 400,   q: 1.0, gain: 0, label: '400 Hz' },
  { type: 'peaking',   frequency: 1000,  q: 1.0, gain: 0, label: '1 kHz' },
  { type: 'peaking',   frequency: 2500,  q: 1.0, gain: 0, label: '2.5 kHz' },
  { type: 'peaking',   frequency: 6000,  q: 1.0, gain: 0, label: '6 kHz' },
  { type: 'highshelf', frequency: 12000, q: 0.7, gain: 0, label: '12 kHz' },
]

function autoLabel(freq: number): string {
  if (freq >= 1000) {
    const k = freq / 1000
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1)} kHz`
  }
  return `${Math.round(freq)} Hz`
}

/**
 * True for filter types whose biquad doesn't use `gain` to shape its curve
 * (HPF/LPF/notch/bandpass/allpass). For these, the visual node is locked to
 * the 0 dB centerline since gain is meaningless.
 */
export function isCutoffType(type: BiquadFilterType): boolean {
  return (
    type === 'highpass' ||
    type === 'lowpass' ||
    type === 'notch' ||
    type === 'bandpass' ||
    type === 'allpass'
  )
}

// Utility presets — surgical filters and sub-removal shapes a mixing engineer
// actually reaches for. Use the "Add band" button to combine these.
export const EQ_PRESETS: EqPreset[] = [
  {
    name: 'Flat',
    bands: DEFAULT_BANDS.map((b) => ({ ...b })),
  },
  {
    name: 'HPF 40 Hz',
    bands: [
      { type: 'highpass', frequency: 40,  q: 0.707, gain: 0, label: '40 Hz HPF' },
    ],
  },
  {
    name: 'HPF 80 Hz',
    bands: [
      { type: 'highpass', frequency: 80,  q: 0.707, gain: 0, label: '80 Hz HPF' },
    ],
  },
  {
    name: 'HPF 120 Hz',
    bands: [
      { type: 'highpass', frequency: 120, q: 0.707, gain: 0, label: '120 Hz HPF' },
    ],
  },
  {
    name: 'LPF 18 kHz',
    bands: [
      { type: 'lowpass',  frequency: 18000, q: 0.707, gain: 0, label: '18 kHz LPF' },
    ],
  },
  {
    name: 'LPF 10 kHz',
    bands: [
      { type: 'lowpass',  frequency: 10000, q: 0.707, gain: 0, label: '10 kHz LPF' },
    ],
  },
  {
    name: 'LPF 5 kHz',
    bands: [
      { type: 'lowpass',  frequency: 5000,  q: 0.707, gain: 0, label: '5 kHz LPF' },
    ],
  },
  {
    name: 'Notch 60 Hz',
    bands: [
      { type: 'notch',    frequency: 60,    q: 12, gain: 0, label: '60 Hz notch' },
    ],
  },
  {
    name: 'Notch 50 Hz',
    bands: [
      { type: 'notch',    frequency: 50,    q: 12, gain: 0, label: '50 Hz notch' },
    ],
  },
  {
    name: 'De-mud 250',
    bands: [
      { type: 'peaking',  frequency: 250,   q: 1.5, gain: -6, label: '250 Hz cut' },
    ],
  },
  {
    name: 'De-harsh 3k',
    bands: [
      { type: 'peaking',  frequency: 3000,  q: 3, gain: -4, label: '3 kHz cut' },
    ],
  },
  {
    name: 'De-ess 7k',
    bands: [
      { type: 'peaking',  frequency: 7000,  q: 4, gain: -5, label: '7 kHz cut' },
    ],
  },
  {
    name: 'HPF + LPF',
    bands: [
      { type: 'highpass', frequency: 60,    q: 0.707, gain: 0, label: '60 Hz HPF' },
      { type: 'lowpass',  frequency: 18000, q: 0.707, gain: 0, label: '18 kHz LPF' },
    ],
  },
  {
    name: 'Phone band',
    bands: [
      { type: 'highpass', frequency: 300,   q: 0.707, gain: 0, label: '300 Hz HPF' },
      { type: 'lowpass',  frequency: 3400,  q: 0.707, gain: 0, label: '3.4 kHz LPF' },
    ],
  },
]

export interface UseEqPlayerOptions {
  initialBands?: EqBandState[]
  fftSize?: number
}

export function useEqPlayer(opts: UseEqPlayerOptions = {}) {
  const fftSize = opts.fftSize ?? 2048
  const bands = ref<EqBandState[]>(
    (opts.initialBands ?? DEFAULT_BANDS).map((b) => ({ ...b })),
  )

  const isPlaying = ref(false)
  const isReady = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const audioEl = shallowRef<HTMLAudioElement | null>(null)

  let ctx: AudioContext | null = null
  let source: MediaElementAudioSourceNode | null = null
  let filters: BiquadFilterNode[] = []
  let analyser: AnalyserNode | null = null
  let spectrumBuffer: Float32Array | null = null
  let rafId: number | null = null
  let objectUrl: string | null = null

  function ensureContext(): AudioContext {
    if (!ctx) {
      const Ctor = (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      ctx = new Ctor()
    }
    return ctx
  }

  function buildFilters(): void {
    const c = ensureContext()
    filters = bands.value.map((band) => {
      const f = c.createBiquadFilter()
      f.type = band.type
      f.frequency.value = band.frequency
      f.Q.value = band.q
      f.gain.value = band.gain
      return f
    })
  }

  function wireChain(): void {
    if (!source || !analyser) return
    // Connect: source → f1 → f2 → ... → fN → analyser
    let prev: AudioNode = source
    for (const f of filters) {
      prev.connect(f)
      prev = f
    }
    prev.connect(analyser)
  }

  function rebuildFilters(): void {
    if (!source || !analyser) {
      // Not wired yet — just rebuild the state, wiring happens on load().
      return
    }
    try { source.disconnect() } catch { /* noop */ }
    for (const f of filters) { try { f.disconnect() } catch { /* noop */ } }
    buildFilters()
    wireChain()
  }

  function wireGraph(el: HTMLAudioElement): void {
    const c = ensureContext()
    source = c.createMediaElementSource(el)

    buildFilters()

    analyser = c.createAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = 0.78
    spectrumBuffer = new Float32Array(analyser.frequencyBinCount)

    wireChain()
    analyser.connect(c.destination)
  }

  async function load(input: File | string): Promise<void> {
    teardown({ keepContext: true })
    isReady.value = false
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }

    const el = audioEl.value
    if (!el) throw new Error('audio element not mounted')

    const src = typeof input === 'string' ? input : URL.createObjectURL(input)
    if (typeof input !== 'string') objectUrl = src

    el.src = src
    el.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        el.removeEventListener('loadedmetadata', onReady)
        el.removeEventListener('error', onError)
        resolve()
      }
      const onError = () => {
        el.removeEventListener('loadedmetadata', onReady)
        el.removeEventListener('error', onError)
        reject(new Error('Failed to load audio.'))
      }
      el.addEventListener('loadedmetadata', onReady)
      el.addEventListener('error', onError)
      el.load()
    })

    duration.value = el.duration

    if (!source) wireGraph(el)
    isReady.value = true
  }

  async function play(): Promise<void> {
    const el = audioEl.value
    if (!el) return
    const c = ensureContext()
    if (c.state === 'suspended') await c.resume()
    await el.play()
    isPlaying.value = true
    startTransportLoop()
  }

  function pause(): void {
    const el = audioEl.value
    if (!el) return
    el.pause()
    isPlaying.value = false
    stopTransportLoop()
  }

  function toggle(): Promise<void> | void {
    return isPlaying.value ? pause() : play()
  }

  function seek(seconds: number): void {
    const el = audioEl.value
    if (!el) return
    el.currentTime = Math.max(0, Math.min(seconds, el.duration || 0))
    currentTime.value = el.currentTime
  }

  function setBandGain(index: number, gainDb: number): void {
    const b = bands.value[index]
    if (!b) return
    // HPF/LPF/notch/bandpass/allpass don't shape their curve via gain — keep
    // the param at 0 so the canvas node visually stays on the 0 dB centerline.
    if (isCutoffType(b.type)) {
      b.gain = 0
      if (filters[index]) filters[index].gain.value = 0
      return
    }
    b.gain = gainDb
    if (filters[index]) filters[index].gain.value = gainDb
  }

  function setBandFreq(index: number, frequencyHz: number): void {
    const b = bands.value[index]
    if (!b) return
    b.frequency = frequencyHz
    b.label = autoLabel(frequencyHz)
    if (filters[index]) filters[index].frequency.value = frequencyHz
  }

  function setBandQ(index: number, q: number): void {
    const b = bands.value[index]
    if (!b) return
    b.q = q
    if (filters[index]) filters[index].Q.value = q
  }

  function applyPreset(preset: EqPreset): void {
    bands.value = preset.bands.map((b) => ({ ...b }))
    rebuildFilters()
  }

  function resetEq(): void {
    applyPreset({ name: 'Flat', bands: DEFAULT_BANDS.map((b) => ({ ...b })) })
  }

  function addBand(partial: Partial<EqBandState> = {}): number {
    const band: EqBandState = {
      type: partial.type ?? 'peaking',
      frequency: partial.frequency ?? 1000,
      q: partial.q ?? 1.0,
      gain: partial.gain ?? 0,
      label: partial.label ?? autoLabel(partial.frequency ?? 1000),
    }
    bands.value = [...bands.value, band]
    rebuildFilters()
    return bands.value.length - 1
  }

  function removeBand(index: number): void {
    if (index < 0 || index >= bands.value.length) return
    if (bands.value.length <= 1) return
    bands.value = bands.value.filter((_, i) => i !== index)
    rebuildFilters()
  }

  function setBandType(index: number, type: BiquadFilterType): void {
    const b = bands.value[index]
    if (!b) return
    b.type = type
    if (isCutoffType(type)) b.gain = 0
    rebuildFilters()
  }

  function getSpectrum(): Float32Array | null {
    if (!analyser || !spectrumBuffer) return null
    analyser.getFloatFrequencyData(spectrumBuffer)
    return spectrumBuffer
  }

  /**
   * Fill outDb with the cascade's frequency response (dB) at the given
   * frequencies. Sums dB across all BiquadFilter stages since they're
   * series-cascaded.
   */
  function getEqCurveDb(freqs: Float32Array, outDb: Float32Array): void {
    outDb.fill(0)
    if (filters.length === 0) return
    const mag = new Float32Array(freqs.length)
    const phase = new Float32Array(freqs.length)
    for (const f of filters) {
      f.getFrequencyResponse(freqs, mag, phase)
      for (let i = 0; i < freqs.length; i++) {
        outDb[i] += 20 * Math.log10(Math.max(1e-6, mag[i]))
      }
    }
  }

  function getSampleRate(): number {
    return ctx?.sampleRate ?? 44100
  }

  function startTransportLoop(): void {
    if (rafId !== null) return
    const tick = () => {
      const el = audioEl.value
      if (el) currentTime.value = el.currentTime
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  function stopTransportLoop(): void {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }

  function teardown(o: { keepContext?: boolean } = {}): void {
    stopTransportLoop()
    if (analyser) { try { analyser.disconnect() } catch { /* noop */ } analyser = null }
    for (const f of filters) { try { f.disconnect() } catch { /* noop */ } }
    filters = []
    if (source) { try { source.disconnect() } catch { /* noop */ } source = null }
    spectrumBuffer = null
    isPlaying.value = false
    isReady.value = false
    duration.value = 0
    currentTime.value = 0
    if (!o.keepContext && ctx) {
      ctx.close().catch(() => {})
      ctx = null
    }
  }

  onBeforeUnmount(() => {
    teardown()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  })

  return {
    audioEl,
    bands,
    isPlaying,
    isReady,
    currentTime,
    duration,
    load,
    play,
    pause,
    toggle,
    seek,
    setBandGain,
    setBandFreq,
    setBandQ,
    setBandType,
    addBand,
    removeBand,
    applyPreset,
    resetEq,
    getSpectrum,
    getEqCurveDb,
    getSampleRate,
  }
}
