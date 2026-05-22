<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { SITE_INFO } from '@/lib/siteInfo'

useHead({
  title: 'Legal Notice — Beatmakerbox',
  meta: [
    { name: 'description', content: 'Legal notice / mentions légales for Beatmakerbox.' },
    { name: 'robots', content: 'index, follow' },
  ],
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
    <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Legal Notice</h1>
    <p class="mt-2 text-sm text-[var(--color-text-muted)]">
      Mentions légales — required by French LCEN.
    </p>

    <dl class="mt-10 space-y-6 text-[var(--color-text-soft)]">
      <div>
        <dt class="label">Publisher</dt>
        <dd class="mt-1 text-[var(--color-text)]">{{ SITE_INFO.editor }}</dd>
      </div>

      <div>
        <dt class="label">Contact</dt>
        <dd class="mt-1">
          <a :href="`mailto:${SITE_INFO.email}`" class="ink-link">{{ SITE_INFO.email }}</a>
        </dd>
      </div>

      <div>
        <dt class="label">Hosting</dt>
        <dd class="mt-1 text-[var(--color-text)]">{{ SITE_INFO.hosting }}</dd>
      </div>

      <div>
        <dt class="label">Site</dt>
        <dd class="mt-1 text-[var(--color-text)]">Beatmakerbox — free in-browser audio tools and sample-pack aggregator.</dd>
      </div>
    </dl>
  </div>
</template>
