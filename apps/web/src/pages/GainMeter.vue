<script setup lang="ts">
import { useHead } from '@unhead/vue'
import ToolboxGainMeter from '@/components/ToolboxGainMeter.vue'

useHead({
  title: 'Gain & Loudness Meter — Peak, RMS, LUFS · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free in-browser loudness meter. Measure peak dBFS, RMS and integrated LUFS-I (BS.1770) of any audio file. No upload, no signup.' },
    { property: 'og:title', content: 'Gain & Loudness Meter — Peak, RMS, LUFS' },
    { property: 'og:description', content: 'Measure peak dBFS, RMS and LUFS-I of any audio file. In your browser.' },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(163,230,53,0.14); border-color: rgba(163,230,53,0.3); color: var(--color-lime);">tool · 08</span>
        <span class="chip">BS.1770</span>
        <span class="chip">100% browser</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        Gain & <span class="text-[var(--color-lime)]">Loudness</span> Meter
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Drop any audio file — get peak dBFS, RMS and integrated loudness (LUFS-I).
        Know exactly how hot your sample is before dropping it in your DAW.
      </p>
    </header>

    <div class="panel p-6 sm:p-8">
      <ToolboxGainMeter />
    </div>

    <section class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label" style="color: var(--color-lime);">01 · peak dBFS</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          The loudest sample across all channels. Above −1 dBFS risks clipping in your chain. Below −6 dBFS is comfortable headroom.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-lime);">02 · RMS</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Root mean square — the perceived average loudness. Useful for matching levels between samples before mixing.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-lime);">03 · LUFS-I (BS.1770)</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          K-weighted integrated loudness per ITU-R BS.1770. Spotify and YouTube normalize to −14 LUFS, Apple Music to −16 LUFS.
        </p>
      </div>
    </section>
  </div>
</template>
