<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const taps = ref<number[]>([])
const TAP_WINDOW = 3000 // ms — resets tap history after this gap

const bpm = computed<number | null>(() => {
  if (taps.value.length < 2) return null
  let sum = 0
  for (let i = 1; i < taps.value.length; i++) {
    sum += taps.value[i] - taps.value[i - 1]
  }
  return 60000 / (sum / (taps.value.length - 1))
})

const bpmRounded = computed(() =>
  bpm.value !== null ? Math.round(bpm.value * 10) / 10 : null
)

function tap() {
  const now = performance.now()
  // Drop old taps outside the window
  const fresh = taps.value.filter((t) => now - t < TAP_WINDOW)
  fresh.push(now)
  taps.value = fresh
}

function reset() { taps.value = [] }

// Keyboard shortcut: T key (only when toolbox is visible, no input focused)
function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
  if (e.code === 'KeyT') { e.preventDefault(); tap() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Delay table: given BPM, compute note durations in ms
interface DelayRow { label: string; ms: number; key: string }
const delayRows = computed<DelayRow[]>(() => {
  const b = bpmRounded.value
  if (!b) return []
  const beat = 60000 / b
  return [
    { key: '1/1',     label: '1/1 (whole)',       ms: beat * 4 },
    { key: '1/2',     label: '1/2 (half)',         ms: beat * 2 },
    { key: '1/2d',    label: '1/2 dotted',         ms: beat * 3 },
    { key: '1/4',     label: '1/4 (quarter)',      ms: beat },
    { key: '1/4d',    label: '1/4 dotted',         ms: beat * 1.5 },
    { key: '1/4t',    label: '1/4 triplet',        ms: beat * (2 / 3) },
    { key: '1/8',     label: '1/8 (eighth)',       ms: beat / 2 },
    { key: '1/8d',    label: '1/8 dotted',         ms: beat * 0.75 },
    { key: '1/8t',    label: '1/8 triplet',        ms: beat / 3 },
    { key: '1/16',    label: '1/16 (sixteenth)',   ms: beat / 4 },
    { key: '1/16d',   label: '1/16 dotted',        ms: beat * 0.375 },
    { key: '1/16t',   label: '1/16 triplet',       ms: beat / 6 },
    { key: '1/32',    label: '1/32',               ms: beat / 8 },
  ]
})

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(3)}s` : `${ms.toFixed(1)}ms`
}

// Manual BPM input
const manualInput = ref('')
function onManualInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (isFinite(v) && v > 0) {
    // Override tap history with a synthetic "two tap" giving exact BPM
    const interval = 60000 / v
    const now = performance.now()
    taps.value = [now - interval, now]
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- BPM display + tap button -->
    <div class="flex flex-col items-center gap-3">
      <div class="screen flex h-20 w-full items-center justify-center rounded-md">
        <span v-if="bpmRounded" class="mono text-5xl font-bold text-[var(--color-cyan)] tabular-nums">
          {{ bpmRounded }}
        </span>
        <span v-else class="mono text-2xl text-[var(--color-text-muted)]">— BPM</span>
      </div>

      <button
        type="button"
        class="w-full rounded-md border-2 border-[var(--color-cyan)] bg-[var(--color-cyan)]/10 py-4 text-sm font-bold text-[var(--color-cyan)] transition-all active:scale-95 active:bg-[var(--color-cyan)]/20 select-none"
        @click="tap"
      >
        TAP
        <span class="mono ml-1 text-[10px] font-normal opacity-50">T</span>
        <span v-if="taps.length >= 2" class="mono ml-2 text-[10px] font-normal opacity-60">
          ×{{ taps.length }} taps
        </span>
      </button>

      <div class="flex w-full items-center gap-2">
        <input
          type="number"
          min="20"
          max="400"
          step="0.1"
          placeholder="or type BPM…"
          class="flex-1 rounded-md border border-[var(--color-edge)] bg-[var(--color-surface-2)] px-3 py-1.5 text-center text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-cyan)] focus:outline-none"
          :value="manualInput"
          @input="onManualInput"
        />
        <button
          type="button"
          class="rounded-md border border-[var(--color-edge)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]"
          @click="reset"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Delay table -->
    <div v-if="delayRows.length > 0">
      <p class="label mb-2">Delay / reverb times</p>
      <div class="screen overflow-hidden rounded-md">
        <table class="w-full text-xs">
          <tbody>
            <tr
              v-for="row in delayRows"
              :key="row.key"
              class="border-b border-[var(--color-edge-soft)]/40 last:border-0"
            >
              <td class="mono px-2.5 py-1.5 text-[var(--color-text-muted)]">{{ row.key }}</td>
              <td class="px-1 py-1.5 text-[var(--color-text-soft)]">{{ row.label }}</td>
              <td class="mono px-2.5 py-1.5 text-right font-semibold text-[var(--color-cyan)]">
                {{ fmtMs(row.ms) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p v-else class="text-center text-xs text-[var(--color-text-muted)]">
      Tap in rhythm to get the BPM and the delay table.
    </p>
  </div>
</template>
