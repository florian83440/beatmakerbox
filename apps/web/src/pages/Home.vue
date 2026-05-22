<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useHead } from '@unhead/vue'

useHead({
  title: 'Beatmakerbox — Free in-browser audio tools for beatmakers',
  meta: [
    { name: 'description', content: 'Free, fast, private audio tools for beatmakers and producers. Detect key, find BPM, visualize EQ, tune your 808s, chop samples — all running 100% in your browser. No upload, no signup.' },
    { property: 'og:title', content: 'Beatmakerbox — Free in-browser audio tools for beatmakers' },
    { property: 'og:description', content: 'Key Finder, BPM Finder, EQ Visualizer, 808 Tuner, Metronome, Sample Chopper. 100% browser. No signup.' },
    { property: 'og:type', content: 'website' },
  ],
})

interface Tool {
  num: string
  slug: string
  name: string
  category: string
  description: string
  accent: string
  ready: boolean
}

const tools: Tool[] = [
  {
    num: '01',
    slug: 'key-finder',
    name: 'Key Finder',
    category: 'Analysis',
    description: 'Detect the musical key and mode of any sample. Includes Camelot code for harmonic mixing.',
    accent: 'var(--color-accent)',
    ready: true,
  },
  {
    num: '02',
    slug: 'bpm-finder',
    name: 'BPM Finder',
    category: 'Tempo',
    description: 'Find the BPM of any track. Spectral-flux onset detection with octave-folding to the musical range.',
    accent: 'var(--color-cyan)',
    ready: true,
  },
  {
    num: '03',
    slug: 'eq-visualizer',
    name: 'EQ Visualizer',
    category: 'Live FX',
    description: 'Load a track, EQ it live with a 7-band parametric, watch the post-EQ spectrum react in real time.',
    accent: 'var(--color-lime)',
    ready: true,
  },
  {
    num: '04',
    slug: 'note-tuner',
    name: '808 / Note Tuner',
    category: 'Pitch',
    description: 'Drop a one-shot — get the note, octave, and cents deviation. Tune your 808s in one click.',
    accent: 'var(--color-magenta)',
    ready: true,
  },
  {
    num: '05',
    slug: 'metronome',
    name: 'Metronome',
    category: 'Tempo',
    description: 'Sample-accurate metronome using Web Audio look-ahead scheduling. Subdivisions, accents, taps.',
    accent: 'var(--color-violet)',
    ready: true,
  },
  {
    num: '06',
    slug: 'sample-chopper',
    name: 'Sample Chopper',
    category: 'Sampling',
    description: 'Slice a loop into pads MPC-style, drag steps into a pattern, export the rearranged sequence as a WAV.',
    accent: 'var(--color-teal)',
    ready: true,
  },
  {
    num: '07',
    slug: 'packs',
    name: 'Free Sample Packs',
    category: 'Discovery',
    description: 'Daily-aggregated free drum kits, loops and 808s from Reddit, Freesound, producer blogs and YouTube.',
    accent: 'var(--color-emerald)',
    ready: true,
  },
]
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
    <!-- Hero -->
    <section class="max-w-3xl">
      <div class="flex items-center gap-2">
        <span class="chip chip-accent">v0.1 · live</span>
        <span class="chip">free</span>
        <span class="chip">no signup</span>
      </div>

      <h1 class="mt-6 text-balance text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
        Audio tools for beatmakers.
        <span class="text-[var(--color-accent)]">Built for speed.</span>
      </h1>

      <p class="mt-6 max-w-xl text-lg text-[var(--color-text-soft)]">
        Find the key, tempo and tonal balance of any sample — in one click.
        Everything runs in your browser. No upload, no tracker, no signup.
      </p>

      <div class="mt-8 flex flex-wrap items-center gap-3">
        <RouterLink to="/key-finder" class="btn-primary">
          Try Key Finder
          <span class="transition-transform group-hover:translate-x-1">→</span>
        </RouterLink>
        <a href="#tools" class="btn-ghost">
          See all tools
        </a>
      </div>
    </section>

    <!-- Tools grid -->
    <section id="tools" class="mt-20">
      <div class="mb-5 flex items-end justify-between">
        <div>
          <p class="label">Tools</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            The toolkit
          </h2>
        </div>
        <p class="mono text-xs text-[var(--color-text-muted)]">
          {{ tools.filter(t => t.ready).length }} live · {{ tools.filter(t => !t.ready).length }} in dev
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <component
          :is="tool.ready ? RouterLink : 'div'"
          v-for="tool in tools"
          :key="tool.slug"
          :to="tool.ready ? `/${tool.slug}` : undefined"
          class="panel group relative flex flex-col p-5 transition-all"
          :class="
            tool.ready
              ? 'cursor-pointer hover:-translate-y-0.5'
              : 'cursor-not-allowed opacity-55'
          "
          :style="tool.ready ? `--hover-accent:${tool.accent}` : ''"
        >
          <!-- Header row -->
          <div class="flex items-baseline justify-between">
            <div class="flex items-center gap-2">
              <span class="mono text-xs font-semibold" :style="{ color: tool.accent }">
                {{ tool.num }}
              </span>
              <span class="label !text-[9px]">{{ tool.category }}</span>
            </div>
            <span v-if="tool.ready" class="led led-on"></span>
            <span v-else class="led"></span>
          </div>

          <h3 class="mt-3 text-lg font-semibold leading-tight">
            <span
              :class="tool.ready ? 'transition-colors group-hover:text-[var(--hover-accent)]' : ''"
              :style="tool.ready ? '--hover-accent:' + tool.accent : ''"
            >
              {{ tool.name }}
            </span>
          </h3>

          <p class="mt-1.5 flex-1 text-sm text-[var(--color-text-soft)]">{{ tool.description }}</p>

          <p
            v-if="tool.ready"
            class="mono mt-4 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100"
            :style="{ color: tool.accent }"
          >
            open →
          </p>
          <p v-else class="mono mt-4 text-xs text-[var(--color-text-muted)]">
            coming soon
          </p>
        </component>
      </div>
    </section>

    <!-- Why panel -->
    <section class="mt-20 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label">privacy</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Your files never leave your browser. Everything is decoded and analyzed locally with Web Audio API.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label">speed</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          No server queue. Heavy jobs run in Web Workers, so the UI stays smooth even on long files.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label">no signup</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Open, use, leave. No account, no paywall, no third-party cookies.
        </p>
      </div>
    </section>
  </div>
</template>
