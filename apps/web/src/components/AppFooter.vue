<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <footer class="mt-20 border-t border-[var(--color-edge-soft)] bg-[var(--color-bg-2)]/40 py-8">
    <div class="mx-auto max-w-6xl px-4 sm:px-6">
      <div class="grid gap-6 text-sm sm:grid-cols-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="led led-on"></span>
            <span class="label">Status</span>
          </div>
          <p class="mt-2 text-[var(--color-text-soft)]">
            All tools online. Running in your browser — nothing leaves your machine.
          </p>
        </div>
        <div>
          <p class="label">Tools</p>
          <ul class="mt-2 space-y-1 text-[var(--color-text-soft)]">
            <li><RouterLink to="/key-finder" class="ink-link">Key Finder</RouterLink></li>
            <li><RouterLink to="/bpm-finder" class="ink-link">BPM Finder</RouterLink></li>
            <li><RouterLink to="/eq-visualizer" class="ink-link">EQ Visualizer</RouterLink></li>
            <li><RouterLink to="/note-tuner" class="ink-link">808 / Note Tuner</RouterLink></li>
            <li><RouterLink to="/metronome" class="ink-link">Metronome</RouterLink></li>
            <li><RouterLink to="/sample-chopper" class="ink-link">Sample Chopper</RouterLink></li>
            <li><RouterLink to="/gain-meter" class="ink-link">Gain & Loudness Meter</RouterLink></li>
            <li><RouterLink to="/bpm-tap" class="ink-link">BPM Tap & Delay Calc</RouterLink></li>
            <li><RouterLink to="/bit-crusher" class="ink-link">Bit Crusher</RouterLink></li>
            <li><RouterLink to="/packs" class="ink-link">Free Sample Packs</RouterLink></li>
          </ul>
        </div>
        <div>
          <p class="label">Built with</p>
          <p class="mt-2 text-[var(--color-text-soft)]">
            Vue 3 · Web Audio API · Krumhansl-Schmuckler · fft.js
          </p>
        </div>
      </div>

      <div class="mt-8 flex flex-col items-start justify-between gap-3 border-t border-[var(--color-edge-soft)] pt-4 text-xs text-[var(--color-text-muted)] sm:flex-row sm:items-center">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p>© {{ new Date().getFullYear() }} Beatmakerbox.</p>
          <RouterLink to="/contact" class="transition-colors hover:text-[var(--color-text)]">Contact</RouterLink>
          <RouterLink to="/terms" class="transition-colors hover:text-[var(--color-text)]">Terms</RouterLink>
          <RouterLink to="/privacy" class="transition-colors hover:text-[var(--color-text)]">Privacy</RouterLink>
          <RouterLink to="/legal" class="transition-colors hover:text-[var(--color-text)]">Legal</RouterLink>
        </div>
        <p class="mono">100% client-side · no tracker · no signup</p>
      </div>
    </div>
  </footer>
</template>
