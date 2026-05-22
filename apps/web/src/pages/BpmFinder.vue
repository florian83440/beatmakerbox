<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useHead } from '@unhead/vue'
import FileDropzone from '@/components/FileDropzone.vue'
import { useAudioFile } from '@/composables/useAudioFile'
import type { BpmResult } from '@beatmakerbox/dsp'
import type { BpmWorkerRequest, BpmWorkerResponse } from '@/workers/bpm.worker'

useHead({
  title: 'BPM Finder — Detect the tempo of any track · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free online BPM detector. Drop a track and get its tempo in seconds. Spectral-flux onset detection + autocorrelation, all in your browser.' },
    { property: 'og:title', content: 'BPM Finder — Detect the tempo of any track' },
    { property: 'og:description', content: 'Free in-browser BPM detector. Drop a track, get the tempo. No upload.' },
    { property: 'og:type', content: 'website' },
  ],
})

const audio = useAudioFile()
const result = ref<BpmResult | null>(null)
const isAnalyzing = ref(false)
const error = ref<string | null>(null)

let worker: Worker | null = null
let nextRequestId = 0
const pending = new Map<number, (res: BpmWorkerResponse) => void>()

async function ensureWorker(): Promise<Worker> {
  if (!worker) {
    // Lazy-import the worker module — its `?worker` suffix creates a class
    // that extends the DOM Worker, which doesn't exist during SSG. Importing
    // it eagerly at the top of the file would crash the pre-renderer.
    const { default: BpmWorkerCtor } = await import('@/workers/bpm.worker?worker')
    worker = new BpmWorkerCtor()
    worker.addEventListener('message', (e: MessageEvent<BpmWorkerResponse>) => {
      const cb = pending.get(e.data.id)
      if (cb) {
        pending.delete(e.data.id)
        cb(e.data)
      }
    })
  }
  return worker
}

async function runWorker(signal: Float32Array, sampleRate: number): Promise<BpmWorkerResponse> {
  const w = await ensureWorker()
  const id = ++nextRequestId
  // We copy the signal so the main thread can keep the original (the user
  // might re-analyze with different options without re-decoding).
  const copy = new Float32Array(signal)
  return new Promise((resolve) => {
    pending.set(id, resolve)
    const req: BpmWorkerRequest = { id, signal: copy, sampleRate }
    w.postMessage(req, [copy.buffer])
  })
}

async function onFile(file: File): Promise<void> {
  error.value = null
  result.value = null
  isAnalyzing.value = true
  try {
    const decoded = await audio.load(file)
    if (!decoded || !audio.monoSignal.value) {
      error.value = audio.error.value ?? 'Failed to decode the file.'
      return
    }
    const t0 = performance.now()
    const response = await runWorker(audio.monoSignal.value, decoded.sampleRate)
    if (response.error || !response.result) {
      error.value = response.error ?? 'BPM analysis failed.'
      return
    }
    result.value = { ...response.result, durationMs: performance.now() - t0 }
  } finally {
    isAnalyzing.value = false
  }
}

function reset(): void {
  result.value = null
  error.value = null
  audio.reset()
}

const confidenceColor = computed(() => {
  if (!result.value) return ''
  switch (result.value.confidence) {
    case 'high':   return 'var(--color-lime)'
    case 'medium': return 'var(--color-yellow)'
    default:       return 'var(--color-magenta)'
  }
})

const envelopePath = computed(() => {
  if (!result.value || result.value.envelopePreview.length === 0) return ''
  const points = result.value.envelopePreview
  const w = 600
  const h = 80
  const stepX = w / (points.length - 1)
  let path = `M 0 ${h - points[0] * h}`
  for (let i = 1; i < points.length; i++) {
    path += ` L ${(i * stepX).toFixed(1)} ${(h - points[i] * h).toFixed(1)}`
  }
  return path
})

onBeforeUnmount(() => {
  if (worker) {
    worker.terminate()
    worker = null
  }
  pending.clear()
})
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(41,200,255,0.14); border-color: rgba(41,200,255,0.3); color: var(--color-cyan);">tool · 02</span>
        <span class="chip">100% browser</span>
        <span class="chip">web worker</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        BPM <span class="text-[var(--color-cyan)]">Finder</span>
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Drop any track — get its tempo. Spectral-flux onset detection + autocorrelation,
        with octave-folding to keep the result in the musical 70-180 BPM range.
      </p>
    </header>

    <FileDropzone
      v-if="!result"
      :busy="isAnalyzing || audio.isBusy.value"
      :file-name="audio.fileName.value"
      busy-label="Detecting tempo…"
      accent="cyan"
      @file="onFile"
    />

    <div
      v-if="error"
      class="panel-flat mt-4 border-l-2 border-l-[var(--color-magenta)] px-4 py-3 text-sm text-[var(--color-magenta)]"
    >
      {{ error }}
    </div>

    <div v-if="result" class="space-y-5">
      <div class="panel-flat flex items-center justify-between px-4 py-2.5">
        <p class="mono truncate text-xs text-[var(--color-text-muted)]">
          {{ audio.fileName.value }}
        </p>
        <button
          type="button"
          class="text-xs font-medium text-[var(--color-cyan)] hover:opacity-80"
          @click="reset"
        >
          Analyze another →
        </button>
      </div>

      <div class="panel overflow-hidden">
        <div class="grid gap-0 sm:grid-cols-[1.6fr_1fr]">
          <div class="screen p-8 sm:p-10">
            <p class="label">Detected tempo</p>
            <p class="mt-2 text-7xl font-bold leading-none tracking-tight sm:text-8xl">
              <span class="text-[var(--color-cyan)]">{{ result.bpm.toFixed(1) }}</span>
              <span class="ml-2 text-2xl font-medium text-[var(--color-text-soft)] sm:text-3xl">BPM</span>
            </p>
            <div class="mt-5 flex items-center gap-3">
              <span class="chip">range</span>
              <span class="mono text-sm text-[var(--color-text-soft)]">70-180 BPM, octave-folded</span>
            </div>
          </div>

          <div class="flex flex-col gap-4 border-t border-[var(--color-edge-soft)] p-6 sm:border-l sm:border-t-0">
            <div>
              <p class="label">Confidence</p>
              <p class="mono mt-1 text-3xl font-bold capitalize" :style="{ color: confidenceColor }">
                {{ result.confidence }}
              </p>
              <p class="mono text-xs text-[var(--color-text-muted)]">
                peak strength {{ (result.strength * 100).toFixed(0) }}%
              </p>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p class="label !text-[9px]">Analyzed</p>
                <p class="mono mt-1 text-sm text-[var(--color-text)]">{{ result.analyzedSeconds.toFixed(0) }}s</p>
              </div>
              <div>
                <p class="label !text-[9px]">Compute</p>
                <p class="mono mt-1 text-sm text-[var(--color-text)]">{{ result.durationMs.toFixed(0) }}ms</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Onset envelope preview -->
      <div class="panel p-5 sm:p-6">
        <div class="mb-3 flex items-center justify-between">
          <p class="label">Onset envelope</p>
          <p class="mono text-[10px] text-[var(--color-text-muted)]">spectral flux over time</p>
        </div>
        <div class="screen p-2">
          <svg viewBox="0 0 600 80" class="h-20 w-full" preserveAspectRatio="none">
            <path :d="envelopePath" fill="none" stroke="var(--color-cyan)" stroke-width="1.2" />
          </svg>
        </div>
      </div>

      <!-- Candidates -->
      <div class="panel p-5 sm:p-6">
        <p class="label mb-3">Other candidates</p>
        <ul class="divide-y divide-[var(--color-edge-soft)]">
          <li
            v-for="(c, i) in result.candidates"
            :key="i"
            class="flex items-center justify-between py-2.5"
          >
            <span class="flex items-center gap-3">
              <span class="mono w-12 text-base font-semibold" :class="i === 0 ? 'text-[var(--color-cyan)]' : 'text-[var(--color-text)]'">
                {{ c.bpm.toFixed(1) }}
              </span>
              <span class="text-sm text-[var(--color-text-muted)]">BPM</span>
            </span>
            <span class="mono text-sm text-[var(--color-text-muted)]">
              {{ (c.strength * 100).toFixed(0) }}%
            </span>
          </li>
        </ul>
      </div>
    </div>

    <section v-if="!result" class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label" style="color: var(--color-cyan);">01 · onset</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Spectral flux extracts a per-frame "attack curve" — far cleaner than raw RMS for percussive music.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-cyan);">02 · autocorrelation</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Autocorrelation of the onset curve reveals the dominant period — the beat.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-cyan);">03 · web worker</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Analysis runs in a background thread, so long files won't freeze the UI.
        </p>
      </div>
    </section>
  </div>
</template>
