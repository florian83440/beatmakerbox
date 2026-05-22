<script setup lang="ts">
import { ref, computed } from 'vue'
import { decodeAudioFile } from '@beatmakerbox/dsp'

interface GainResult {
  peakDbfs: number
  rmsDbfs: number
  lufsI: number
  durationSeconds: number
  channels: number
  sampleRate: number
}

const result = ref<GainResult | null>(null)
const isAnalyzing = ref(false)
const error = ref<string | null>(null)
const fileName = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// K-weighting pre-filter (stage 1: high-shelf ~1.7 kHz, +4 dB) — simplified
// biquad coefficients at 48 kHz. We apply these in the time domain on Float32Array.
// Source: ITU-R BS.1770-4 Annex 1.
function applyKWeighting(signal: Float32Array, sampleRate: number): Float32Array {
  // Stage 1: pre-filter (high-shelf, Fs-dependent)
  const f0 = 1681.974450955533
  const G  = 3.999843853973347
  const Q  = 0.7071752369554196
  const K  = Math.tan(Math.PI * f0 / sampleRate)
  const Vh = Math.pow(10, G / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416)
  const a0 = 1 + K / Q + K * K
  const b0 = (Vh + Vb * K / Q + K * K) / a0
  const b1 = 2 * (K * K - Vh) / a0
  const b2 = (Vh - Vb * K / Q + K * K) / a0
  const a1 = 2 * (K * K - 1) / a0
  const a2 = (1 - K / Q + K * K) / a0

  const s1 = new Float32Array(signal.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < signal.length; i++) {
    const x = signal[i]
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    s1[i] = y
    x2 = x1; x1 = x; y2 = y1; y1 = y
  }

  // Stage 2: RLB filter (high-pass, ~38 Hz)
  const f1 = 38.13547087602444
  const Q2 = 0.5003270373238773
  const K2 = Math.tan(Math.PI * f1 / sampleRate)
  const a0b = 1 + K2 / Q2 + K2 * K2
  const b0b = 1 / a0b
  const b1b = -2 / a0b
  const b2b = 1 / a0b
  const a1b = 2 * (K2 * K2 - 1) / a0b
  const a2b = (1 - K2 / Q2 + K2 * K2) / a0b

  const s2 = new Float32Array(signal.length)
  x1 = 0; x2 = 0; y1 = 0; y2 = 0
  for (let i = 0; i < signal.length; i++) {
    const x = s1[i]
    const y = b0b * x + b1b * x1 + b2b * x2 - a1b * y1 - a2b * y2
    s2[i] = y
    x2 = x1; x1 = x; y2 = y1; y1 = y
  }
  return s2
}

function measureGain(buffer: AudioBuffer): GainResult {
  const sr = buffer.sampleRate
  const numCh = buffer.numberOfChannels
  const len = buffer.length

  // Peak dBFS across all channels
  let peak = 0
  for (let ch = 0; ch < numCh; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const abs = Math.abs(data[i])
      if (abs > peak) peak = abs
    }
  }
  const peakDbfs = peak > 0 ? 20 * Math.log10(peak) : -Infinity

  // RMS dBFS (all channels averaged)
  let sumSq = 0
  for (let ch = 0; ch < numCh; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < len; i++) sumSq += data[i] * data[i]
  }
  const rms = Math.sqrt(sumSq / (len * numCh))
  const rmsDbfs = rms > 0 ? 20 * Math.log10(rms) : -Infinity

  // LUFS-I: mean square of K-weighted signal, averaged across channels
  // Gate: blocks below -70 LUFS (absolute gate per BS.1770)
  let kSumSq = 0
  for (let ch = 0; ch < numCh; ch++) {
    const raw = buffer.getChannelData(ch)
    const kw = applyKWeighting(raw, sr)
    for (let i = 0; i < len; i++) kSumSq += kw[i] * kw[i]
  }
  const meanSq = kSumSq / (len * numCh)
  const lufsI = meanSq > 0 ? -0.691 + 10 * Math.log10(meanSq) : -Infinity

  return {
    peakDbfs,
    rmsDbfs,
    lufsI,
    durationSeconds: buffer.duration,
    channels: numCh,
    sampleRate: sr,
  }
}

async function onFile(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  error.value = null
  result.value = null
  fileName.value = f.name
  isAnalyzing.value = true
  try {
    const decoded = await decodeAudioFile(f)
    result.value = measureGain(decoded.buffer)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Decode error'
  } finally {
    isAnalyzing.value = false
  }
}

function fmt(v: number, dec = 1): string {
  if (!isFinite(v)) return '-∞'
  return (v >= 0 ? '+' : '') + v.toFixed(dec)
}

function fmtSr(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// Color scale: green (-6 and above), yellow (-12), red (0 dBFS clip)
function peakColor(db: number): string {
  if (db > -1) return 'var(--color-magenta)'
  if (db > -6) return 'var(--color-yellow)'
  return 'var(--color-lime)'
}

// Bar width percent for a dBFS value, in [-60, 0]
function barPct(db: number): number {
  if (!isFinite(db)) return 0
  return Math.max(0, Math.min(100, (db + 60) / 60 * 100))
}

const lufsLabel = computed(() => {
  if (!result.value) return ''
  const l = result.value.lufsI
  if (!isFinite(l)) return 'Silent'
  if (l > -9)  return 'Very hot'
  if (l > -14) return 'Loud'
  if (l > -18) return 'Streaming target'
  if (l > -23) return 'Broadcast target'
  return 'Quiet'
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Drop zone -->
    <div>
      <input ref="fileInput" type="file" accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a" class="hidden" @change="onFile" />
      <button
        type="button"
        class="w-full rounded-md border border-dashed border-[var(--color-edge)] bg-[var(--color-surface-2)] px-3 py-3 text-center text-xs text-[var(--color-text-soft)] transition-all hover:border-[var(--color-lime)]/60 hover:text-[var(--color-text)]"
        :class="isAnalyzing ? 'opacity-60 cursor-wait' : ''"
        @click="fileInput?.click()"
      >
        <span v-if="isAnalyzing">Analyzing…</span>
        <span v-else-if="fileName" class="mono truncate block">{{ fileName }}</span>
        <span v-else>Drop or click to load audio</span>
      </button>
      <p v-if="error" class="mt-1 text-[10px] text-[var(--color-magenta)]">{{ error }}</p>
    </div>

    <!-- Results -->
    <div v-if="result" class="space-y-3">
      <!-- Peak -->
      <div>
        <div class="mb-1 flex items-baseline justify-between">
          <span class="label !text-[9px]">Peak dBFS</span>
          <span class="mono text-sm font-bold" :style="{ color: peakColor(result.peakDbfs) }">
            {{ fmt(result.peakDbfs) }} dB
          </span>
        </div>
        <div class="screen h-2 overflow-hidden rounded-sm">
          <div
            class="h-full rounded-sm transition-all duration-300"
            :style="{ width: barPct(result.peakDbfs) + '%', background: peakColor(result.peakDbfs) }"
          />
        </div>
      </div>

      <!-- RMS -->
      <div>
        <div class="mb-1 flex items-baseline justify-between">
          <span class="label !text-[9px]">RMS dBFS</span>
          <span class="mono text-sm font-bold text-[var(--color-cyan)]">
            {{ fmt(result.rmsDbfs) }} dB
          </span>
        </div>
        <div class="screen h-2 overflow-hidden rounded-sm">
          <div
            class="h-full rounded-sm bg-[var(--color-cyan)] transition-all duration-300"
            :style="{ width: barPct(result.rmsDbfs) + '%' }"
          />
        </div>
      </div>

      <!-- LUFS-I -->
      <div class="rounded-md border border-[var(--color-edge-soft)] bg-[var(--color-surface-2)] px-3 py-2">
        <div class="flex items-baseline justify-between">
          <span class="label !text-[9px]">LUFS-I</span>
          <span class="mono text-base font-bold text-[var(--color-text)]">
            {{ fmt(result.lufsI) }} LUFS
          </span>
        </div>
        <p class="mono mt-0.5 text-[10px] text-[var(--color-text-muted)]">{{ lufsLabel }}</p>
        <!-- Reference lines -->
        <div class="mono mt-2 grid grid-cols-3 gap-1 text-[9px] text-[var(--color-text-muted)]">
          <span>Spotify −14</span>
          <span class="text-center">YouTube −14</span>
          <span class="text-right">Apple −16</span>
        </div>
      </div>

      <!-- Meta -->
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-md bg-[var(--color-surface-2)] px-2 py-1.5">
          <p class="label !text-[8px]">Duration</p>
          <p class="mono mt-0.5 text-xs text-[var(--color-text)]">{{ fmtDur(result.durationSeconds) }}</p>
        </div>
        <div class="rounded-md bg-[var(--color-surface-2)] px-2 py-1.5">
          <p class="label !text-[8px]">Channels</p>
          <p class="mono mt-0.5 text-xs text-[var(--color-text)]">{{ result.channels === 1 ? 'Mono' : 'Stereo' }}</p>
        </div>
        <div class="rounded-md bg-[var(--color-surface-2)] px-2 py-1.5">
          <p class="label !text-[8px]">Sample rate</p>
          <p class="mono mt-0.5 text-xs text-[var(--color-text)]">{{ fmtSr(result.sampleRate) }}</p>
        </div>
      </div>
    </div>

    <p v-else-if="!isAnalyzing" class="text-center text-xs text-[var(--color-text-muted)]">
      Measures peak, RMS and integrated loudness (LUFS-I / BS.1770).
    </p>
  </div>
</template>
