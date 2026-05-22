<script setup lang="ts">
import { useHead } from '@unhead/vue'
import ToolboxBitCrusher from '@/components/ToolboxBitCrusher.vue'

useHead({
  title: 'Bit Crusher — Lo-fi audio effect · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free in-browser bit crusher. Reduce bit depth (1–16 bit) and sample rate to get lo-fi, vintage or glitchy textures. Export the result as WAV. No upload.' },
    { property: 'og:title', content: 'Bit Crusher — Lo-fi audio effect' },
    { property: 'og:description', content: 'Reduce bit depth and sample rate for lo-fi textures. Export WAV. In your browser.' },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(255,122,26,0.14); border-color: rgba(255,122,26,0.3); color: var(--color-accent);">tool · 10</span>
        <span class="chip">bit depth</span>
        <span class="chip">WAV export</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        Bit <span class="text-[var(--color-accent)]">Crusher</span>
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Drop a sample, dial down the bit depth and sample rate — from crisp 16-bit down to
        crunchy 4-bit. Preview the result live, then export as a WAV ready for your sampler.
      </p>
    </header>

    <div class="panel p-6 sm:p-8">
      <ToolboxBitCrusher />
    </div>

    <section class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label" style="color: var(--color-accent);">01 · bit depth</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Quantizes each sample to 2ⁿ levels. 8-bit gives the Akai MPC / SP-1200 crunch. 4-bit goes full Game Boy. 1-bit is one-bit noise.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-accent);">02 · sample rate reduction</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Holds each sample for N frames (zero-order hold) — the same technique vintage samplers used when running at low clock speeds. Adds aliasing and grit.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-accent);">03 · live preview + WAV export</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          A 2-second preview re-renders as you drag the sliders so you can hear changes immediately. Export renders the full file at the original sample rate.
        </p>
      </div>
    </section>
  </div>
</template>
