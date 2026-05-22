<script setup lang="ts">
import { useHead } from '@unhead/vue'
import ToolboxBpmTap from '@/components/ToolboxBpmTap.vue'

useHead({
  title: 'BPM Tap & Delay Calculator — Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free tap tempo tool with delay time calculator. Tap in rhythm, get the BPM and a full table of note durations in milliseconds — 1/4, 1/8, dotted, triplets.' },
    { property: 'og:title', content: 'BPM Tap & Delay Calculator' },
    { property: 'og:description', content: 'Tap tempo + delay time table (ms). 1/4, 1/8, dotted, triplets. In your browser.' },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(41,200,255,0.14); border-color: rgba(41,200,255,0.3); color: var(--color-cyan);">tool · 09</span>
        <span class="chip">tap tempo</span>
        <span class="chip">delay table</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        BPM Tap & <span class="text-[var(--color-cyan)]">Delay</span> Calculator
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Tap in rhythm to detect the BPM, or type it directly.
        Get the full delay table — quarter, eighth, dotted, triplets — in milliseconds,
        ready to plug into your reverb or delay plugin.
      </p>
    </header>

    <div class="panel p-6 sm:p-8">
      <ToolboxBpmTap />
    </div>

    <section class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label" style="color: var(--color-cyan);">01 · tap in rhythm</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Click the TAP button (or press <kbd class="mono rounded border border-[var(--color-edge)] px-1 text-[10px]">T</kbd>) in rhythm — BPM is averaged across your last taps within a 3-second window.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-cyan);">02 · delay times</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Every note value from 1/1 to 1/32 — including dotted and triplet variants.
          Paste the ms value directly into your delay or reverb pre-delay.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-cyan);">03 · manual input</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Know the BPM already? Type it in the field — the delay table updates instantly without needing to tap.
        </p>
      </div>
    </section>
  </div>
</template>
