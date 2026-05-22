<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { useChopper, SLICE_COUNT_OPTIONS, type SliceCount } from '@/composables/useChopper'
import { extractWaveform, toMono } from '@beatmakerbox/dsp'

useHead({
  title: 'Sample Chopper — Slice loops and export WAV · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free in-browser sample chopper. Slice any loop into pads, audition them, arrange a pattern, export the result as a WAV. MPC-style workflow, zero upload.' },
    { property: 'og:title', content: 'Sample Chopper — Slice loops and export WAV' },
    { property: 'og:description', content: 'MPC-style chopper. Slice, rearrange, export WAV. In your browser.' },
    { property: 'og:type', content: 'website' },
  ],
})

const chop = useChopper()
const fileInput = ref<HTMLInputElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

let waveformPeaks: { pos: Float32Array; neg: Float32Array } | null = null
let rafId: number | null = null
let cachedBuffer: AudioBuffer | null = null
let cachedMono: Float32Array | null = null

// ---- canvas ------------------------------------------------------------

function rebuildWaveformPeaks(targetSamples: number): void {
  if (!chop.decoded.value) {
    waveformPeaks = null
    cachedBuffer = null
    cachedMono = null
    return
  }
  if (cachedBuffer !== chop.decoded.value.buffer) {
    cachedBuffer = chop.decoded.value.buffer
    cachedMono = toMono(cachedBuffer)
  }
  if (!cachedMono) return
  waveformPeaks = extractWaveform(cachedMono, targetSamples)
}

function drawWaveform(): void {
  const canvas = canvasEl.value
  if (!canvas) return
  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) return

  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
  }
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx2d.clearRect(0, 0, cssW, cssH)

  if (!chop.decoded.value) return

  const targetCols = Math.max(2, Math.floor(cssW))
  if (!waveformPeaks || waveformPeaks.pos.length !== targetCols) {
    rebuildWaveformPeaks(targetCols)
  }
  if (!waveformPeaks) return

  const mid = cssH / 2

  // --- waveform fill ---
  ctx2d.beginPath()
  ctx2d.moveTo(0, mid)
  for (let i = 0; i < waveformPeaks.pos.length; i++) {
    const x = (i / (waveformPeaks.pos.length - 1)) * cssW
    const y = mid - waveformPeaks.pos[i] * (cssH * 0.45)
    ctx2d.lineTo(x, y)
  }
  for (let i = waveformPeaks.neg.length - 1; i >= 0; i--) {
    const x = (i / (waveformPeaks.neg.length - 1)) * cssW
    const y = mid - waveformPeaks.neg[i] * (cssH * 0.45)
    ctx2d.lineTo(x, y)
  }
  ctx2d.closePath()
  const grad = ctx2d.createLinearGradient(0, 0, 0, cssH)
  grad.addColorStop(0, 'rgba(45,212,191,0.55)')
  grad.addColorStop(0.5, 'rgba(45,212,191,0.85)')
  grad.addColorStop(1, 'rgba(45,212,191,0.55)')
  ctx2d.fillStyle = grad
  ctx2d.fill()

  // Center line
  ctx2d.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx2d.lineWidth = 1
  ctx2d.beginPath()
  ctx2d.moveTo(0, mid)
  ctx2d.lineTo(cssW, mid)
  ctx2d.stroke()

  // --- slice markers ---
  const slices = chop.slices.value
  if (slices.length === 0) return
  const totalDuration = chop.decoded.value.durationSeconds
  ctx2d.font = '10px "JetBrains Mono", monospace'

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]
    const x = (slice.startSeconds / totalDuration) * cssW
    ctx2d.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx2d.lineWidth = 1
    ctx2d.beginPath()
    ctx2d.moveTo(x, 0)
    ctx2d.lineTo(x, cssH)
    ctx2d.stroke()

    // Slice number badge
    ctx2d.fillStyle = 'rgba(20,20,20,0.7)'
    ctx2d.fillRect(x + 2, 2, 20, 14)
    ctx2d.fillStyle = '#2dd4bf'
    ctx2d.fillText(String(i + 1).padStart(2, '0'), x + 4, 13)
  }

  // Highlight currently auditioning slice
  if (chop.auditioningSlice.value !== null) {
    const slice = slices[chop.auditioningSlice.value]
    if (slice) {
      const x1 = (slice.startSeconds / totalDuration) * cssW
      const x2 = ((slice.startSeconds + slice.durationSeconds) / totalDuration) * cssW
      ctx2d.fillStyle = 'rgba(45,212,191,0.15)'
      ctx2d.fillRect(x1, 0, x2 - x1, cssH)
    }
  }
}

function startDrawLoop(): void {
  if (rafId !== null) return
  const tick = () => {
    drawWaveform()
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}
function stopDrawLoop(): void {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
}

// ---- click on waveform → audition that slice ---------------------------
function onCanvasClick(e: MouseEvent): void {
  const canvas = canvasEl.value
  if (!canvas || !chop.decoded.value) return
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const cssW = rect.width
  const totalDuration = chop.decoded.value.durationSeconds
  const t = (x / cssW) * totalDuration
  const sliceIdx = chop.slices.value.findIndex((s) => t >= s.startSeconds && t < s.startSeconds + s.durationSeconds)
  if (sliceIdx >= 0) void chop.auditionSlice(sliceIdx)
}

// ---- file loading ------------------------------------------------------
function pickFile(): void { fileInput.value?.click() }

async function onFileChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  const f = target.files?.[0]
  if (!f) return
  await chop.load(f)
  // Force waveform peaks rebuild on next frame
  waveformPeaks = null
}

watch(() => chop.sliceCount.value, () => { /* peaks already cover the full file */ })

// ---- pattern drag-and-drop ---------------------------------------------
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(idx: number, e: DragEvent): void {
  dragFromIndex.value = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
}
function onDragOver(idx: number, e: DragEvent): void {
  e.preventDefault()
  dragOverIndex.value = idx
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}
function onDragLeave(): void {
  dragOverIndex.value = null
}
function onDrop(idx: number, e: DragEvent): void {
  e.preventDefault()
  if (dragFromIndex.value === null) return
  chop.moveStep(dragFromIndex.value, idx)
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function formatMs(s: number): string {
  return s < 1 ? `${(s * 1000).toFixed(0)}ms` : `${s.toFixed(2)}s`
}

// ---- lifecycle ---------------------------------------------------------
watch(() => chop.decoded.value, () => {
  waveformPeaks = null
})

onMounted(() => {
  startDrawLoop()
})

onBeforeUnmount(() => {
  stopDrawLoop()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(45,212,191,0.14); border-color: rgba(45,212,191,0.3); color: var(--color-teal);">tool · 06</span>
        <span class="chip">MPC-style</span>
        <span class="chip">WAV export</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        Sample <span class="text-[var(--color-teal)]">Chopper</span>
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Drop a loop, slice it into equal pads, click each one to audition, drag them into a pattern,
        and export the rearranged sequence as a WAV. 100% in your browser.
      </p>
    </header>

    <!-- Toolbar -->
    <div class="panel mb-3 flex flex-wrap items-center gap-3 p-3">
      <button type="button" class="btn-ghost" @click="pickFile">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        {{ chop.fileName.value ? 'Replace file' : 'Load audio file' }}
      </button>

      <div class="ml-2 flex items-center gap-1">
        <span class="label mr-2">Slices</span>
        <button
          v-for="n in SLICE_COUNT_OPTIONS"
          :key="n"
          type="button"
          class="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
          :class="chop.sliceCount.value === n
            ? 'border-[var(--color-teal)] bg-[var(--color-teal)]/15 text-[var(--color-teal)]'
            : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
          @click="chop.setSliceCount(n as SliceCount)"
        >
          {{ n }}
        </button>
      </div>

      <p v-if="chop.fileName.value" class="mono ml-auto truncate text-xs text-[var(--color-text-muted)]">
        {{ chop.fileName.value }}
      </p>

      <input
        ref="fileInput"
        type="file"
        accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*"
        class="hidden"
        @change="onFileChange"
      />
    </div>

    <div
      v-if="chop.error.value"
      class="panel-flat mb-4 border-l-2 border-l-[var(--color-magenta)] px-4 py-3 text-sm text-[var(--color-magenta)]"
    >
      {{ chop.error.value }}
    </div>

    <!-- Waveform canvas -->
    <div class="panel p-3">
      <div class="screen relative">
        <canvas
          ref="canvasEl"
          class="block h-[180px] w-full cursor-pointer"
          @click="onCanvasClick"
        />
        <div v-if="!chop.isLoaded.value" class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p class="label">Load an audio loop to start chopping</p>
        </div>
      </div>
      <p class="mono mt-2 text-[10px] text-[var(--color-text-muted)]">
        Click anywhere on the waveform to audition that slice.
      </p>
    </div>

    <!-- Slice pads grid -->
    <div v-if="chop.isLoaded.value" class="panel mt-3 p-4">
      <div class="mb-3 flex items-center justify-between">
        <p class="label">Slice pads</p>
        <p class="mono text-[10px] text-[var(--color-text-muted)]">
          {{ chop.slices.value.length }} pads · ~{{ chop.slices.value[0] ? formatMs(chop.slices.value[0].durationSeconds) : '0ms' }} each
        </p>
      </div>

      <div
        class="grid gap-1.5"
        :style="{
          gridTemplateColumns: `repeat(${Math.min(16, chop.slices.value.length)}, minmax(0, 1fr))`,
        }"
      >
        <button
          v-for="slice in chop.slices.value"
          :key="slice.index"
          type="button"
          class="group relative flex aspect-square flex-col items-center justify-center rounded-md border text-xs font-semibold transition-all"
          :class="
            chop.auditioningSlice.value === slice.index
              ? 'border-[var(--color-teal)] bg-[var(--color-teal)]/25 text-[var(--color-teal)] scale-95'
              : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)] hover:border-[var(--color-teal)]/40 hover:text-[var(--color-text)]'
          "
          :title="`Click: audition · Shift+Click: add to pattern`"
          @click="chop.auditionSlice(slice.index)"
          @contextmenu.prevent="chop.addStep(slice.index)"
          @dblclick="chop.addStep(slice.index)"
        >
          <span class="mono">{{ String(slice.index + 1).padStart(2, '0') }}</span>
          <button
            type="button"
            class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-sm border border-transparent text-[10px] text-[var(--color-text-muted)] opacity-0 transition-all hover:border-[var(--color-teal)]/40 hover:bg-[var(--color-teal)]/10 hover:text-[var(--color-teal)] group-hover:opacity-100"
            title="Add to pattern"
            @click.stop="chop.addStep(slice.index)"
          >
            +
          </button>
        </button>
      </div>
      <p class="mono mt-3 text-[10px] text-[var(--color-text-muted)]">
        Click a pad to audition · Double-click or right-click (or the + on hover) to add it to the pattern.
      </p>
    </div>

    <!-- Pattern row -->
    <div v-if="chop.isLoaded.value" class="panel mt-3 p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="label">Pattern</p>
          <p class="mono text-[10px] text-[var(--color-text-muted)]">
            {{ chop.pattern.value.length }} steps · {{ formatMs(chop.patternDurationSeconds.value) }} total
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="mono flex cursor-pointer items-center gap-1.5 text-xs text-[var(--color-text-soft)]">
            <input
              type="checkbox"
              class="h-3.5 w-3.5 accent-[var(--color-teal)]"
              :checked="chop.isLooping.value"
              @change="chop.isLooping.value = ($event.target as HTMLInputElement).checked"
            />
            loop
          </label>
          <button
            type="button"
            class="btn-primary"
            :style="{ background: 'var(--color-teal)', color: '#0a0a0a' }"
            :disabled="chop.pattern.value.length === 0"
            @click="chop.isPlayingPattern.value ? chop.stopAll() : chop.playPattern()"
          >
            <svg v-if="!chop.isPlayingPattern.value" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l14 8L6 20V4z" />
            </svg>
            <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" />
            </svg>
            {{ chop.isPlayingPattern.value ? 'Stop' : 'Play pattern' }}
          </button>
          <button
            type="button"
            class="btn-ghost"
            :disabled="chop.pattern.value.length === 0"
            @click="chop.clearPattern()"
          >
            Clear
          </button>
          <button
            type="button"
            class="btn-ghost"
            :disabled="chop.pattern.value.length === 0 || chop.isExporting.value"
            @click="chop.exportPatternWav()"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            {{ chop.isExporting.value ? 'Rendering…' : 'Export WAV' }}
          </button>
        </div>
      </div>

      <div
        v-if="chop.pattern.value.length === 0"
        class="rounded-md border border-dashed border-[var(--color-edge)] py-8 text-center"
      >
        <p class="text-sm text-[var(--color-text-muted)]">
          Pattern is empty. Double-click a pad above to add it here.
        </p>
      </div>

      <div v-else class="flex flex-wrap gap-1.5">
        <div
          v-for="(step, idx) in chop.pattern.value"
          :key="step.id"
          class="group relative flex h-12 min-w-[3rem] cursor-grab items-center justify-center rounded-md border-2 text-sm font-semibold transition-all active:cursor-grabbing"
          :class="[
            chop.playheadStep.value === idx && chop.isPlayingPattern.value
              ? 'border-[var(--color-teal)] bg-[var(--color-teal)] text-[#0a0a0a]'
              : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:border-[var(--color-teal)]/50',
            dragOverIndex === idx ? '!border-[var(--color-teal)]' : '',
            dragFromIndex === idx ? 'opacity-40' : '',
          ]"
          draggable="true"
          @dragstart="(e) => onDragStart(idx, e)"
          @dragover="(e) => onDragOver(idx, e)"
          @dragleave="onDragLeave"
          @drop="(e) => onDrop(idx, e)"
        >
          <span class="mono">{{ String(step.sliceIndex + 1).padStart(2, '0') }}</span>
          <button
            type="button"
            class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--color-edge)] bg-[var(--color-surface)] text-[10px] text-[var(--color-text-muted)] opacity-0 transition-all hover:border-[var(--color-magenta)] hover:bg-[var(--color-magenta)]/20 hover:text-[var(--color-magenta)] group-hover:opacity-100"
            title="Remove step"
            @click="chop.removeStep(step.id)"
          >×</button>
        </div>
      </div>
    </div>

    <!-- How it works -->
    <section v-if="!chop.isLoaded.value" class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label" style="color: var(--color-teal);">01 · slice evenly</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Drop a loop and divide it into 4 / 8 / 16 / 32 / 64 equal pads. Click any pad (or anywhere on the waveform) to audition.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-teal);">02 · build a pattern</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Double-click a pad to add it to the pattern. Drag the pattern steps to reorder. Loop while you tweak.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-teal);">03 · export</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Render the pattern to a 16-bit WAV — sample-accurate, no recompression, ready to drop in your DAW.
        </p>
      </div>
    </section>
  </div>
</template>
