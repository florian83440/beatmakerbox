<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { SITE_INFO } from '@/lib/siteInfo'

useHead({
  title: 'Contact — Beatmakerbox',
  meta: [
    { name: 'description', content: 'Get in touch with Beatmakerbox — bug, feature request, sample pack submission, or just to say hi.' },
  ],
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
    <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Contact</h1>
    <p class="mt-4 text-[var(--color-text-soft)]">
      Bug report, feature request, a sample pack to submit, or just want to say hi —
      drop an email. No signup, no list, no auto-reply bot.
    </p>

    <div class="panel mt-8 p-6">
      <p class="label mb-2">Email</p>
      <a
        :href="`mailto:${SITE_INFO.email}`"
        class="text-lg font-semibold text-[var(--color-accent)] hover:underline"
      >
        {{ SITE_INFO.email }}
      </a>
    </div>

    <p class="mt-6 text-sm text-[var(--color-text-muted)]">
      Replies usually within a few days.
    </p>
  </div>
</template>
