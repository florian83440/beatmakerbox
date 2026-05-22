<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  /** Comma-separated extension list + audio/*. Default audio. */
  accept?: string
  /** Status text shown when actively processing. */
  busyLabel?: string
  /** Tool-tinted hover accent. Default uses --color-accent. */
  accent?: 'orange' | 'cyan' | 'lime' | 'magenta' | 'yellow'
  /** True while parent is processing the chosen file. */
  busy?: boolean
  /** File name to display when something is already loaded. */
  fileName?: string | null
  /** Subtitle text under the main message. */
  hint?: string
}

withDefaults(defineProps<Props>(), {
  accept: '.mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*',
  busyLabel: 'Analyzing…',
  accent: 'orange',
  busy: false,
  fileName: null,
  hint: 'MP3 · WAV · FLAC · OGG · M4A · AAC',
})

const emit = defineEmits<{
  (e: 'file', file: File): void
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const accentMap: Record<NonNullable<Props['accent']>, string> = {
  orange: 'var(--color-accent)',
  cyan: 'var(--color-cyan)',
  lime: 'var(--color-lime)',
  magenta: 'var(--color-magenta)',
  yellow: 'var(--color-yellow)',
}

function pick(): void {
  inputEl.value?.click()
}

function onChange(e: Event): void {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) emit('file', file)
}

function onDrop(e: DragEvent): void {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('file', file)
}
</script>

<template>
  <div
    class="panel relative overflow-hidden transition-all"
    :class="[
      isDragging ? 'is-dragging' : '',
      busy ? 'pointer-events-none opacity-80' : '',
    ]"
    :style="{ '--accent': accentMap[accent] }"
    @dragenter.prevent="isDragging = true"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
  >
    <button
      type="button"
      class="flex w-full flex-col items-center justify-center gap-5 px-6 py-14 text-center"
      :disabled="busy"
      @click="pick"
    >
      <div
        class="flex h-14 w-14 items-center justify-center rounded-md border transition-all"
        :class="
          busy
            ? 'border-[var(--accent)]/40 bg-[var(--color-surface-2)]'
            : isDragging
              ? 'scale-110 border-[var(--accent)] bg-[var(--accent)]/15'
              : 'border-[var(--color-edge)] bg-[var(--color-surface-2)]'
        "
      >
        <svg v-if="!busy" class="h-6 w-6 transition-colors"
             :class="isDragging ? 'text-[var(--accent)]' : 'text-[var(--color-text-muted)]'"
             fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        <svg v-else class="h-6 w-6 animate-spin text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>

      <div v-if="busy">
        <p class="text-base font-semibold text-[var(--color-text)]">{{ busyLabel }}</p>
        <p v-if="fileName" class="mono mt-1 text-xs text-[var(--color-text-muted)]">{{ fileName }}</p>
      </div>
      <div v-else>
        <p class="text-base font-semibold text-[var(--color-text)]">
          <span class="text-[var(--accent)]">Drop</span> an audio file
          <span class="text-[var(--color-text-muted)] font-normal">or click to browse</span>
        </p>
        <p class="mono mt-2 text-[11px] text-[var(--color-text-muted)]">
          {{ hint }}
        </p>
      </div>
    </button>

    <input
      ref="inputEl"
      type="file"
      :accept="accept"
      class="hidden"
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.panel.is-dragging {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--color-surface));
}
</style>
