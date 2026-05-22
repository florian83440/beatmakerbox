<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useHead } from '@unhead/vue'
import { useMetronome, type Subdivision } from '@/composables/useMetronome'

useHead({
  title: 'Metronome — Sample-accurate online metronome · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free online metronome with subdivisions, accents and tap tempo. Sample-accurate Web Audio scheduling — no drift, no lag, no signup.' },
    { property: 'og:title', content: 'Metronome — Sample-accurate online metronome' },
    { property: 'og:description', content: 'Look-ahead scheduled metronome, subdivisions, accents, tap tempo. In your browser.' },
    { property: 'og:type', content: 'website' },
  ],
})

const metro = useMetronome({ bpm: 100, beatsPerBar: 4, subdivision: 1, accent: true })

// ---- BPM input ----------------------------------------------------------
function onBpmInput(e: Event): void {
  metro.setBpm(parseFloat((e.target as HTMLInputElement).value))
}
function adjustBpm(delta: number): void {
  metro.setBpm(metro.bpm.value + delta)
}

// ---- Subdivision options ------------------------------------------------
const subOptions: Array<{ value: Subdivision; label: string; symbol: string }> = [
  { value: 1, label: 'Quarter', symbol: '♩' },
  { value: 2, label: 'Eighth',  symbol: '♫' },
  { value: 3, label: 'Triplet', symbol: '♪3' },
  { value: 4, label: '16th',    symbol: '𝅘𝅥𝅯𝅘𝅥𝅯' },
]

// ---- Tap tempo ----------------------------------------------------------
const tapHistory = ref<number[]>([])
const TAP_WINDOW_MS = 2000

function tapTempo(): void {
  const now = performance.now()
  tapHistory.value = tapHistory.value.filter((t) => now - t < TAP_WINDOW_MS)
  tapHistory.value.push(now)
  if (tapHistory.value.length >= 2) {
    let sum = 0
    for (let i = 1; i < tapHistory.value.length; i++) {
      sum += tapHistory.value[i] - tapHistory.value[i - 1]
    }
    const avgIntervalMs = sum / (tapHistory.value.length - 1)
    metro.setBpm(60000 / avgIntervalMs)
  }
}

const tapCount = computed(() => tapHistory.value.length)

// ---- Keyboard shortcuts -------------------------------------------------
function onKeyDown(e: KeyboardEvent): void {
  // Ignore when typing in inputs
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  if (e.code === 'Space') {
    e.preventDefault()
    metro.toggle()
  } else if (e.code === 'KeyT') {
    e.preventDefault()
    tapTempo()
  } else if (e.code === 'ArrowUp') {
    e.preventDefault()
    adjustBpm(e.shiftKey ? 10 : 1)
  } else if (e.code === 'ArrowDown') {
    e.preventDefault()
    adjustBpm(e.shiftKey ? -10 : -1)
  }
}

onMounted(() => { window.addEventListener('keydown', onKeyDown) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeyDown) })

// ---- Beat dots indices --------------------------------------------------
const beatIndices = computed(() => Array.from({ length: metro.beatsPerBar.value }, (_, i) => i))

// Subdivision visual ticks per beat
const subIndices = computed(() => Array.from({ length: metro.subdivision.value }, (_, i) => i))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(167,139,250,0.14); border-color: rgba(167,139,250,0.3); color: var(--color-violet);">tool · 05</span>
        <span class="chip">look-ahead</span>
        <span class="chip">sample-accurate</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        <span class="text-[var(--color-violet)]">Metronome</span>
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Sample-accurate Web Audio metronome with subdivisions, accents, and tap tempo.
        Use <kbd class="kbd">space</kbd> to start/stop, <kbd class="kbd">T</kbd> to tap.
      </p>
    </header>

    <!-- BPM display -->
    <div class="panel mb-4 p-6 sm:p-8">
      <div class="flex items-baseline justify-between">
        <p class="label">Tempo</p>
        <p class="mono text-xs text-[var(--color-text-muted)]">
          {{ metro.beatsPerBar.value }}/4 · {{ metro.subdivision.value === 1 ? 'quarter' : metro.subdivision.value === 2 ? 'eighth' : metro.subdivision.value === 3 ? 'triplet' : '16th' }}
        </p>
      </div>

      <div class="mt-3 flex items-center justify-between gap-6">
        <div class="flex items-baseline gap-3">
          <p class="text-7xl font-bold leading-none tracking-tight sm:text-8xl">
            <span class="text-[var(--color-violet)] tabular-nums">{{ metro.bpm.value }}</span>
          </p>
          <p class="mono text-base text-[var(--color-text-soft)]">BPM</p>
        </div>

        <div class="flex flex-col gap-1">
          <button type="button" class="btn-ghost !px-2 !py-1 text-xs" @click="adjustBpm(1)">+1</button>
          <button type="button" class="btn-ghost !px-2 !py-1 text-xs" @click="adjustBpm(-1)">-1</button>
        </div>
      </div>

      <!-- BPM slider -->
      <input
        type="range"
        :min="40"
        :max="240"
        :step="1"
        :value="metro.bpm.value"
        class="mt-4 w-full accent-[var(--color-violet)]"
        @input="onBpmInput"
      />
      <div class="mono mt-1 flex justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>40</span>
        <span>60</span>
        <span>90</span>
        <span>120</span>
        <span>160</span>
        <span>240</span>
      </div>
    </div>

    <!-- Beat indicator -->
    <div class="panel mb-4 p-6">
      <div class="mb-3 flex items-center justify-between">
        <p class="label">Beats</p>
        <p class="mono text-[10px] text-[var(--color-text-muted)]">
          {{ metro.currentBeat.value >= 0 ? `${metro.currentBeat.value + 1} / ${metro.beatsPerBar.value}` : '—' }}
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2 py-2">
        <div
          v-for="i in beatIndices"
          :key="i"
          class="relative flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-75"
          :class="
            metro.currentBeat.value === i && metro.isPlaying.value
              ? (i === 0 && metro.accent.value
                  ? 'border-[var(--color-violet)] bg-[var(--color-violet)] scale-110'
                  : 'border-[var(--color-violet)] bg-[var(--color-violet)]/40 scale-105')
              : (i === 0 && metro.accent.value
                  ? 'border-[var(--color-violet)]/40 bg-[var(--color-surface-2)]'
                  : 'border-[var(--color-edge)] bg-[var(--color-surface-2)]')
          "
        >
          <span
            class="font-mono text-sm font-bold"
            :class="metro.currentBeat.value === i && metro.isPlaying.value && i === 0 && metro.accent.value
              ? 'text-[#0a0a0a]'
              : 'text-[var(--color-text)]'"
          >
            {{ i + 1 }}
          </span>

          <!-- Subdivision sub-dots underneath -->
          <div
            v-if="metro.subdivision.value > 1"
            class="absolute -bottom-3 flex gap-0.5"
          >
            <span
              v-for="s in subIndices"
              :key="s"
              class="h-1 w-1 rounded-full transition-all"
              :class="
                metro.currentBeat.value === i && metro.currentSubBeat.value === s && metro.isPlaying.value
                  ? 'bg-[var(--color-violet)] scale-150'
                  : 'bg-[var(--color-edge)]'
              "
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Controls grid -->
    <div class="grid gap-4 sm:grid-cols-3">
      <!-- Time signature -->
      <div class="panel p-5">
        <p class="label mb-3">Beats per bar</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="n in [2, 3, 4, 5, 6, 7, 8]"
            :key="n"
            type="button"
            class="rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all"
            :class="metro.beatsPerBar.value === n
              ? 'border-[var(--color-violet)] bg-[var(--color-violet)]/15 text-[var(--color-violet)]'
              : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
            @click="metro.setBeatsPerBar(n)"
          >
            {{ n }}
          </button>
        </div>
      </div>

      <!-- Subdivisions -->
      <div class="panel p-5">
        <p class="label mb-3">Subdivision</p>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="opt in subOptions"
            :key="opt.value"
            type="button"
            class="rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all"
            :class="metro.subdivision.value === opt.value
              ? 'border-[var(--color-violet)] bg-[var(--color-violet)]/15 text-[var(--color-violet)]'
              : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
            @click="metro.setSubdivision(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Options -->
      <div class="panel p-5">
        <p class="label mb-3">Options</p>
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="h-4 w-4 accent-[var(--color-violet)]"
            :checked="metro.accent.value"
            @change="metro.accent.value = ($event.target as HTMLInputElement).checked"
          />
          <span class="text-[var(--color-text-soft)]">Accent on beat 1</span>
        </label>
      </div>
    </div>

    <!-- Action bar -->
    <div class="panel mt-4 flex flex-wrap items-center gap-3 p-4">
      <button
        type="button"
        class="btn-primary"
        :style="{ background: 'var(--color-violet)', color: '#0a0a0a' }"
        @click="metro.toggle()"
      >
        <svg v-if="!metro.isPlaying.value" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4l14 8L6 20V4z" />
        </svg>
        <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" />
          <rect x="14" y="5" width="4" height="14" />
        </svg>
        {{ metro.isPlaying.value ? 'Stop' : 'Start' }}
        <span class="mono ml-1 text-[10px] opacity-60">space</span>
      </button>

      <button type="button" class="btn-ghost" @click="tapTempo">
        Tap tempo
        <span class="mono ml-1 text-[10px] opacity-60">T</span>
        <span v-if="tapCount > 0" class="mono ml-1 text-[10px] text-[var(--color-violet)]">
          ×{{ tapCount }}
        </span>
      </button>

      <p class="mono ml-auto hidden text-[10px] text-[var(--color-text-muted)] sm:block">
        ↑/↓ to nudge BPM · shift+↑/↓ for ±10
      </p>
    </div>

    <section class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label" style="color: var(--color-violet);">01 · look-ahead</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Two-clock scheduling — UI timer wakes up the scheduler, which queues clicks 100 ms in advance on the audio clock.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-violet);">02 · sample-accurate</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Each click is fired via <code class="mono text-[var(--color-text)]">oscillator.start(time)</code>. The audio thread plays it exactly on time, immune to UI jitter.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-violet);">03 · tap tempo</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Hit <kbd class="kbd">T</kbd> in rhythm — the BPM is averaged from your last few taps within a 2-second window.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-edge);
  border-bottom-width: 2px;
  border-radius: 3px;
  color: var(--color-text);
  line-height: 1.2;
}
</style>
