<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHead } from '@unhead/vue'
import FileDropzone from '@/components/FileDropzone.vue'
import { detectKey, NOTES, type KeyResult } from '@beatmakerbox/dsp'

useHead({
  title: 'Key Finder — Detect the musical key of any sample · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free online key finder. Drop a sample, get its musical key, mode and Camelot code. Krumhansl-Schmuckler analysis, 100% in your browser. No upload.' },
    { property: 'og:title', content: 'Key Finder — Detect the musical key of any sample' },
    { property: 'og:description', content: 'Drop any sample, get the key and Camelot code. Free, in your browser.' },
    { property: 'og:type', content: 'website' },
  ],
})

const result = ref<KeyResult | null>(null)
const isAnalyzing = ref(false)
const error = ref<string | null>(null)
const currentFileName = ref<string | null>(null)

const confidenceLabel = computed(() => {
  if (!result.value) return ''
  const c = result.value.confidence
  if (c >= 0.85) return 'Very high'
  if (c >= 0.7)  return 'High'
  if (c >= 0.55) return 'Medium'
  return 'Low'
})

const confidenceColor = computed(() => {
  if (!result.value) return ''
  const c = result.value.confidence
  if (c >= 0.7) return 'var(--color-lime)'
  if (c >= 0.55) return 'var(--color-yellow)'
  return 'var(--color-accent)'
})

const maxChroma = computed(() => {
  if (!result.value) return 1
  return Math.max(...result.value.chromagram, 1e-6)
})

const tonicIndex = computed(() => {
  if (!result.value) return -1
  return NOTES.indexOf(result.value.tonic)
})

async function onFile(file: File): Promise<void> {
  error.value = null
  result.value = null
  currentFileName.value = file.name
  isAnalyzing.value = true
  try {
    result.value = await detectKey(file)
  } catch (e) {
    error.value = e instanceof Error
      ? `Couldn't decode the file: ${e.message}`
      : "Couldn't decode the file."
  } finally {
    isAnalyzing.value = false
  }
}

function reset(): void {
  result.value = null
  error.value = null
  currentFileName.value = null
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <!-- Tool header -->
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip chip-accent">tool · 01</span>
        <span class="chip">100% browser</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        Key <span class="text-[var(--color-accent)]">Finder</span>
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Drop any sample — get its musical key, mode, and Camelot code for
        harmonic mixing. Nothing is uploaded; everything runs in your browser.
      </p>
    </header>

    <!-- Dropzone -->
    <FileDropzone
      v-if="!result"
      :busy="isAnalyzing"
      :file-name="currentFileName"
      busy-label="Analyzing…"
      accent="orange"
      @file="onFile"
    />

    <!-- Error -->
    <div
      v-if="error"
      class="panel-flat mt-4 border-l-2 border-l-[var(--color-magenta)] px-4 py-3 text-sm text-[var(--color-magenta)]"
    >
      {{ error }}
    </div>

    <!-- Result -->
    <div v-if="result" class="space-y-5">
      <!-- Toolbar -->
      <div class="panel-flat flex items-center justify-between px-4 py-2.5">
        <p class="mono truncate text-xs text-[var(--color-text-muted)]">
          {{ currentFileName }}
        </p>
        <button
          type="button"
          class="text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          @click="reset"
        >
          Analyze another →
        </button>
      </div>

      <!-- Detected key panel -->
      <div class="panel overflow-hidden">
        <div class="grid gap-0 sm:grid-cols-[1.6fr_1fr]">
          <!-- Screen -->
          <div class="screen p-8 sm:p-10">
            <p class="label">Detected key</p>
            <p class="mt-2 text-7xl font-bold leading-none tracking-tight sm:text-8xl">
              <span class="text-[var(--color-accent)]">{{ result.tonic }}</span>
              <span class="ml-2 text-3xl font-medium text-[var(--color-text-soft)] sm:text-4xl">
                {{ result.mode === 'major' ? 'maj' : 'min' }}
              </span>
            </p>
            <div class="mt-5 flex items-center gap-3">
              <span class="chip">Camelot</span>
              <span class="mono text-base font-semibold text-[var(--color-text)]">{{ result.camelot }}</span>
            </div>
          </div>

          <!-- Side panel — confidence + meta -->
          <div class="flex flex-col gap-4 border-t border-[var(--color-edge-soft)] p-6 sm:border-l sm:border-t-0">
            <div>
              <p class="label">Confidence</p>
              <p class="mono mt-1 text-3xl font-bold" :style="{ color: confidenceColor }">
                {{ (result.confidence * 100).toFixed(0) }}%
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">{{ confidenceLabel }}</p>
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

      <!-- Chromagram -->
      <div class="panel p-5 sm:p-6">
        <div class="mb-4 flex items-center justify-between">
          <p class="label">Chromagram</p>
          <p class="mono text-[10px] text-[var(--color-text-muted)]">energy per pitch class</p>
        </div>
        <div class="grid grid-cols-12 gap-1.5">
          <div
            v-for="(value, i) in result.chromagram"
            :key="i"
            class="flex flex-col items-center gap-1.5"
          >
            <div class="screen relative h-28 w-full">
              <div
                class="absolute bottom-0 w-full rounded-sm transition-all"
                :class="i === tonicIndex ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'"
                :style="{ height: `${(value / maxChroma) * 100}%` }"
              />
            </div>
            <span
              class="mono text-[10px]"
              :class="i === tonicIndex ? 'font-bold text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'"
            >
              {{ NOTES[i] }}
            </span>
          </div>
        </div>
      </div>

      <!-- Alternatives -->
      <div class="panel p-5 sm:p-6">
        <p class="label mb-3">Other candidates</p>
        <ul class="divide-y divide-[var(--color-edge-soft)]">
          <li
            v-for="alt in result.alternatives"
            :key="alt.key"
            class="flex items-center justify-between py-2.5"
          >
            <span class="text-sm text-[var(--color-text-soft)]">{{ alt.key }}</span>
            <span class="mono text-sm text-[var(--color-text-muted)]">
              {{ (alt.confidence * 100).toFixed(0) }}%
            </span>
          </li>
        </ul>
      </div>
    </div>

    <!-- How it works -->
    <section v-if="!result" class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label">01 · privacy</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Your file never leaves your browser. Decoded and analyzed locally with Web Audio API.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label">02 · algorithm</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Chromagram + Krumhansl-Schmuckler key profile correlation — the standard MIR approach.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label">03 · camelot</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Includes the Camelot wheel code so you can mix harmonically with your other tracks.
        </p>
      </div>
    </section>
  </div>
</template>
