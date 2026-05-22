<script setup lang="ts">
import { ref, computed } from 'vue'
import { decodeAudioFile, audioBufferToWav, downloadBlob } from '@beatmakerbox/dsp'

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref<string | null>(null)
const isLoading = ref(false)
const isExporting = ref(false)
const error = ref<string | null>(null)

// Decoded source — kept in memory for re-processing on slider change
let srcBuffer: AudioBuffer | null = null

// Parameters
const bitDepth = ref(8)       // 1–16 bit
const srDivider = ref(1)      // 1 = original, 2 = half, 4 = quarter, 8 = 1/8

const srDividerOptions = [
  { label: '1× (original)', value: 1 },
  { label: '2× (half)',     value: 2 },
  { label: '4× (quarter)',  value: 4 },
  { label: '8× (⅛)',        value: 8 },
]

// Live preview — OfflineAudioContext render of a 2-second excerpt
const previewUrl = ref<string | null>(null)
let prevPreviewUrl: string | null = null

const crushedSr = computed(() =>
  srcBuffer ? Math.round(srcBuffer.sampleRate / srDivider.value) : null
)

const bitLabel = computed(() => {
  if (bitDepth.value >= 16) return '16-bit (CD quality)'
  if (bitDepth.value >= 12) return '12-bit (Akai S950 style)'
  if (bitDepth.value >= 8)  return '8-bit (lo-fi vintage)'
  if (bitDepth.value >= 4)  return '4-bit (extreme lo-fi)'
  return `${bitDepth.value}-bit`
})

/** Apply bit-crush + sample-rate reduction to a Float32Array. */
function crush(samples: Float32Array, bits: number, div: number): Float32Array {
  const levels = Math.pow(2, bits - 1)   // e.g. 128 for 8-bit
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    // Sample-rate reduction: hold the sample at each "div" block
    const src = samples[Math.floor(i / div) * div]
    // Bit-depth quantization
    out[i] = Math.round(src * levels) / levels
  }
  return out
}

async function buildOfflineBuffer(maxSeconds = 60): Promise<AudioBuffer | null> {
  if (!srcBuffer) return null
  const bits  = bitDepth.value
  const div   = srDivider.value
  const srcSr = srcBuffer.sampleRate
  const numCh = srcBuffer.numberOfChannels
  const srcLen = Math.min(srcBuffer.length, Math.floor(maxSeconds * srcSr))

  // Render to offline at the original sample rate so the WAV is standard
  const offline = new OfflineAudioContext(numCh, srcLen, srcSr)
  for (let ch = 0; ch < numCh; ch++) {
    const raw = srcBuffer.getChannelData(ch).subarray(0, srcLen)
    const crushed = crush(raw, bits, div)
    // Build a new AudioBuffer for this channel
    const tmp = offline.createBuffer(1, srcLen, srcSr)
    tmp.copyToChannel(crushed, 0)
    const src = offline.createBufferSource()
    src.buffer = tmp
    src.connect(offline.destination)
    src.start(0)
  }
  return offline.startRendering()
}

async function updatePreview(): Promise<void> {
  if (!srcBuffer) return
  // 2-second preview excerpt
  const buf = await buildOfflineBuffer(2)
  if (!buf) return
  const wav = audioBufferToWav(buf)
  if (prevPreviewUrl) URL.revokeObjectURL(prevPreviewUrl)
  const url = URL.createObjectURL(wav)
  prevPreviewUrl = url
  previewUrl.value = url
}

async function onFile(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  error.value = null
  previewUrl.value = null
  fileName.value = f.name
  isLoading.value = true
  try {
    const decoded = await decodeAudioFile(f)
    srcBuffer = decoded.buffer
    await updatePreview()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Decode error'
    srcBuffer = null
  } finally {
    isLoading.value = false
  }
}

let previewDebounce: number | null = null
function onParamChange(): void {
  if (!srcBuffer) return
  if (previewDebounce !== null) clearTimeout(previewDebounce)
  previewDebounce = window.setTimeout(() => { void updatePreview() }, 300)
}

async function exportWav(): Promise<void> {
  if (!srcBuffer) return
  isExporting.value = true
  try {
    const buf = await buildOfflineBuffer()
    if (!buf) return
    const wav = audioBufferToWav(buf)
    const base = fileName.value?.replace(/\.[^.]+$/, '') ?? 'crushed'
    downloadBlob(wav, `${base}-${bitDepth.value}bit.wav`)
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- File loader -->
    <div>
      <input ref="fileInput" type="file" accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a" class="hidden" @change="onFile" />
      <button
        type="button"
        class="w-full rounded-md border border-dashed border-[var(--color-edge)] bg-[var(--color-surface-2)] px-3 py-3 text-center text-xs text-[var(--color-text-soft)] transition-all hover:border-[var(--color-accent)]/60 hover:text-[var(--color-text)]"
        :class="isLoading ? 'opacity-60 cursor-wait' : ''"
        @click="fileInput?.click()"
      >
        <span v-if="isLoading">Loading…</span>
        <span v-else-if="fileName" class="mono truncate block">{{ fileName }}</span>
        <span v-else>Drop or click to load audio</span>
      </button>
      <p v-if="error" class="mt-1 text-[10px] text-[var(--color-magenta)]">{{ error }}</p>
    </div>

    <!-- Bit depth slider -->
    <div>
      <div class="mb-1 flex items-baseline justify-between">
        <span class="label !text-[9px]">Bit depth</span>
        <span class="mono text-sm font-bold text-[var(--color-accent)]">{{ bitDepth }}-bit</span>
      </div>
      <input
        type="range"
        min="1" max="16" step="1"
        v-model.number="bitDepth"
        class="w-full accent-[var(--color-accent)]"
        @input="onParamChange"
      />
      <div class="mono mt-0.5 flex justify-between text-[9px] text-[var(--color-text-muted)]">
        <span>1</span><span>4</span><span>8</span><span>12</span><span>16</span>
      </div>
      <p class="mt-1 text-[10px] text-[var(--color-text-muted)]">{{ bitLabel }}</p>
    </div>

    <!-- Sample-rate reduction -->
    <div>
      <p class="label mb-2 !text-[9px]">Sample rate reduction</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="opt in srDividerOptions"
          :key="opt.value"
          type="button"
          class="rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all"
          :class="srDivider === opt.value
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
            : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
          @click="srDivider = opt.value; onParamChange()"
        >
          {{ opt.label }}
        </button>
      </div>
      <p v-if="crushedSr" class="mono mt-1 text-[10px] text-[var(--color-text-muted)]">
        Output: {{ crushedSr.toLocaleString() }} Hz
      </p>
    </div>

    <!-- Preview player -->
    <div v-if="previewUrl" class="rounded-md border border-[var(--color-edge-soft)] bg-[var(--color-surface-2)] p-2">
      <p class="label mb-1.5 !text-[9px]">Preview (2 sec)</p>
      <audio :src="previewUrl" controls class="w-full h-8" style="filter: invert(0.85) hue-rotate(160deg) brightness(0.9);" />
    </div>

    <!-- Export -->
    <button
      type="button"
      class="btn-primary w-full justify-center"
      :style="{ background: 'var(--color-accent)', color: '#0a0a0a' }"
      :disabled="!srcBuffer || isExporting"
      :class="(!srcBuffer || isExporting) ? 'opacity-50 cursor-not-allowed' : ''"
      @click="exportWav"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
      </svg>
      {{ isExporting ? 'Rendering…' : 'Export crushed WAV' }}
    </button>

    <p v-if="!srcBuffer && !isLoading" class="text-center text-xs text-[var(--color-text-muted)]">
      Reduce bit depth and sample rate for lo-fi / vintage textures.
    </p>
  </div>
</template>
