<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHead } from '@unhead/vue'
import FileDropzone from '@/components/FileDropzone.vue'
import { detectNote, type NoteDetectionResult } from '@beatmakerbox/dsp'

useHead({
  title: '808 / Note Tuner — Find the note of any sample · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free online pitch detector for 808s, sub-bass, vocals and one-shots. Get the note, octave and cents deviation. YIN-based, runs in your browser.' },
    { property: 'og:title', content: '808 / Note Tuner — Find the note of any sample' },
    { property: 'og:description', content: 'Drop a one-shot, get the note, octave and cents off. Free, in your browser.' },
    { property: 'og:type', content: 'website' },
  ],
})

const result = ref<NoteDetectionResult | null>(null)
const isAnalyzing = ref(false)
const error = ref<string | null>(null)
const currentFileName = ref<string | null>(null)

const clarityLabel = computed(() => {
  if (!result.value) return ''
  const c = result.value.clarity
  if (c >= 0.92) return 'Locked'
  if (c >= 0.8)  return 'Strong'
  if (c >= 0.6)  return 'Decent'
  return 'Weak'
})

const clarityColor = computed(() => {
  if (!result.value) return ''
  const c = result.value.clarity
  if (c >= 0.8)  return 'var(--color-lime)'
  if (c >= 0.6)  return 'var(--color-yellow)'
  return 'var(--color-magenta)'
})

/** Cents in [-50, +50] → percent on a centered bar, 50% = on pitch. */
const centsPercent = computed(() => {
  if (!result.value) return 50
  const c = Math.max(-50, Math.min(50, result.value.cents))
  return 50 + c
})

const tuningHint = computed(() => {
  if (!result.value) return ''
  const c = result.value.cents
  if (Math.abs(c) <= 5) return `Locked on ${result.value.noteName}${result.value.octave}`
  const dir = c > 0 ? 'flat' : 'sharp'
  return `Pitch ${dir} ${Math.abs(c)} cents → tune by ${c > 0 ? '-' : '+'}${Math.abs(c)}¢ to land on ${result.value.noteName}${result.value.octave}`
})

async function onFile(file: File): Promise<void> {
  error.value = null
  result.value = null
  currentFileName.value = file.name
  isAnalyzing.value = true
  try {
    const r = await detectNote(file)
    if (!r.detected) {
      error.value = "Couldn't lock a pitch. Try a longer or more tonal sample (sub bass, single note, vocal)."
    }
    result.value = r
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
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(255,77,141,0.14); border-color: rgba(255,77,141,0.3); color: var(--color-magenta);">tool · 04</span>
        <span class="chip">YIN</span>
        <span class="chip">100% browser</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        808 / Note <span class="text-[var(--color-magenta)]">Tuner</span>
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Drop an 808, a sub-bass, a vocal note or any monophonic one-shot —
        get the note, the octave, and how many cents off it is. Tune your samples in one click.
      </p>
    </header>

    <FileDropzone
      v-if="!result || !result.detected"
      :busy="isAnalyzing"
      :file-name="currentFileName"
      busy-label="Detecting pitch…"
      accent="magenta"
      hint="MP3 · WAV · FLAC · OGG · M4A · AAC — works best on monophonic samples"
      @file="onFile"
    />

    <div
      v-if="error"
      class="panel-flat mt-4 border-l-2 border-l-[var(--color-magenta)] px-4 py-3 text-sm text-[var(--color-magenta)]"
    >
      {{ error }}
    </div>

    <div v-if="result && result.detected" class="space-y-5">
      <div class="panel-flat flex items-center justify-between px-4 py-2.5">
        <p class="mono truncate text-xs text-[var(--color-text-muted)]">
          {{ currentFileName }}
        </p>
        <button
          type="button"
          class="text-xs font-medium text-[var(--color-magenta)] hover:opacity-80"
          @click="reset"
        >
          Analyze another →
        </button>
      </div>

      <div class="panel overflow-hidden">
        <div class="grid gap-0 sm:grid-cols-[1.6fr_1fr]">
          <div class="screen p-8 sm:p-10">
            <p class="label">Detected note</p>
            <p class="mt-2 text-7xl font-bold leading-none tracking-tight sm:text-8xl">
              <span class="text-[var(--color-magenta)]">{{ result.noteName }}</span>
              <span class="ml-1 text-4xl font-medium text-[var(--color-text-soft)] sm:text-5xl">{{ result.octave }}</span>
            </p>
            <p class="mono mt-4 text-sm text-[var(--color-text-soft)]">
              {{ result.frequency.toFixed(2) }} Hz · MIDI {{ result.midi }}
            </p>
          </div>

          <div class="flex flex-col gap-4 border-t border-[var(--color-edge-soft)] p-6 sm:border-l sm:border-t-0">
            <div>
              <p class="label">Clarity</p>
              <p class="mono mt-1 text-3xl font-bold" :style="{ color: clarityColor }">
                {{ (result.clarity * 100).toFixed(0) }}%
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">{{ clarityLabel }}</p>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p class="label !text-[9px]">Analyzed</p>
                <p class="mono mt-1 text-sm text-[var(--color-text)]">{{ (result.analyzedSeconds * 1000).toFixed(0) }}ms</p>
              </div>
              <div>
                <p class="label !text-[9px]">Compute</p>
                <p class="mono mt-1 text-sm text-[var(--color-text)]">{{ result.durationMs.toFixed(0) }}ms</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cents meter -->
      <div class="panel p-5 sm:p-6">
        <div class="mb-3 flex items-center justify-between">
          <p class="label">Pitch deviation</p>
          <p class="mono text-xs font-semibold"
             :style="{ color: Math.abs(result.cents) <= 5 ? 'var(--color-lime)' : 'var(--color-magenta)' }">
            {{ result.cents > 0 ? '+' : '' }}{{ result.cents }} cents
          </p>
        </div>
        <div class="screen relative h-12 overflow-hidden">
          <!-- Center tick (target) -->
          <div class="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--color-lime)]/40"></div>
          <!-- ±25 ticks -->
          <div class="absolute left-1/4 top-1/3 h-1/3 w-px bg-[var(--color-text-faint)]"></div>
          <div class="absolute left-3/4 top-1/3 h-1/3 w-px bg-[var(--color-text-faint)]"></div>
          <!-- Needle -->
          <div
            class="absolute top-1 h-[calc(100%-8px)] w-1 -translate-x-1/2 rounded-full transition-all duration-200"
            :style="{
              left: centsPercent + '%',
              background: Math.abs(result.cents) <= 5 ? 'var(--color-lime)' : 'var(--color-magenta)',
            }"
          ></div>
          <!-- Labels -->
          <span class="mono absolute left-1 top-1 text-[9px] text-[var(--color-text-muted)]">-50¢</span>
          <span class="mono absolute right-1 top-1 text-[9px] text-[var(--color-text-muted)]">+50¢</span>
          <span class="mono absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] text-[var(--color-text-muted)]">0</span>
        </div>
        <p class="mt-3 text-sm text-[var(--color-text-soft)]">
          {{ tuningHint }}
        </p>
      </div>
    </div>

    <section v-if="!result" class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label" style="color: var(--color-magenta);">01 · YIN algorithm</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Cumulative mean normalized difference function (CMNDF) — beats raw autocorrelation by avoiding the classic octave errors on sub-bass.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-magenta);">02 · post-attack window</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Skips the first 50 ms transient, then analyzes the loudest 200 ms region for a stable pitch reading.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-magenta);">03 · monophonic only</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Works on single-note sounds: 808s, sub-bass, vocal notes, leads. Polyphonic material (chords, mixes) needs a different tool.
        </p>
      </div>
    </section>
  </div>
</template>
