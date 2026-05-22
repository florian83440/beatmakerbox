<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useToolbox } from '@/composables/useToolbox'

const tb = useToolbox()

const nav = [
  { to: '/key-finder',     label: 'Key',     accent: 'var(--color-accent)' },
  { to: '/bpm-finder',     label: 'BPM',     accent: 'var(--color-cyan)' },
  { to: '/eq-visualizer',  label: 'EQ',      accent: 'var(--color-lime)' },
  { to: '/note-tuner',     label: 'Note',    accent: 'var(--color-magenta)' },
  { to: '/metronome',      label: 'Click',   accent: 'var(--color-violet)' },
  { to: '/sample-chopper', label: 'Chop',    accent: 'var(--color-teal)' },
  { to: '/gain-meter',     label: 'Gain',    accent: 'var(--color-lime)' },
  { to: '/bpm-tap',        label: 'Tap',     accent: 'var(--color-cyan)' },
  { to: '/bit-crusher',    label: 'Crush',   accent: 'var(--color-accent)' },
  { to: '/packs',          label: 'Packs',   accent: 'var(--color-emerald)' },
]
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-[var(--color-edge-soft)] bg-[var(--color-bg)]/85 backdrop-blur">
    <!-- Main bar -->
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
      <RouterLink to="/" class="flex items-center gap-2.5">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-edge)] bg-[var(--color-surface-2)] text-base font-bold leading-none text-[var(--color-accent)]">b</span>
        <span class="text-[15px] font-semibold tracking-tight">
          beatmaker<span class="text-[var(--color-accent)]">box</span>
        </span>
      </RouterLink>

      <nav class="flex items-center gap-1">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="group relative rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-text-soft)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          active-class="!text-[var(--color-text)] bg-[var(--color-surface-2)]"
        >
          <span
            class="absolute -bottom-px left-3 right-3 h-px opacity-0 transition-opacity group-[.router-link-active]:opacity-100"
            :style="{ background: item.accent }"
          />
          {{ item.label }}
        </RouterLink>

        <!-- Toolbox toggle -->
        <button
          type="button"
          class="ml-1 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all"
          :class="tb.isOpen.value
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-[var(--color-accent)]'
            : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'"
          title="Toolbox — Gain · BPM · Crusher"
          @click="tb.toggle()"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" />
          </svg>
          <span class="hidden sm:inline">Tools</span>
        </button>
      </nav>
    </div>
  </header>
</template>
