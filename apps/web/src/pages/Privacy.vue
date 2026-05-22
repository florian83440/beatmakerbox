<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useHead } from '@unhead/vue'
import { SITE_INFO } from '@/lib/siteInfo'

useHead({
  title: 'Privacy — Beatmakerbox',
  meta: [
    { name: 'description', content: 'How Beatmakerbox handles your data: no cookies, no trackers, no signup. Audio files never leave your browser.' },
    { name: 'robots', content: 'index, follow' },
  ],
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
    <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Privacy</h1>
    <p class="mt-2 text-sm text-[var(--color-text-muted)]">
      Last updated: {{ SITE_INFO.legalUpdated }}
    </p>

    <div class="mt-10 space-y-8 text-[var(--color-text-soft)] leading-relaxed">
      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">Short version</h2>
        <ul class="mt-3 list-disc space-y-1 pl-5">
          <li>No cookies.</li>
          <li>No third-party trackers — no Google Analytics, no Meta pixel, none.</li>
          <li>No account, no login, no email collection beyond what you send via the contact form.</li>
          <li>Audio files you load in the tools <strong>never leave your browser</strong>.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">What touches the network</h2>
        <p class="mt-2">Only two things make a network request from the site:</p>
        <ul class="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Page loads.</strong> A standard HTTP request. The host's web server logs each
            request (IP, timestamp, path, user-agent) for security and abuse mitigation. Logs are
            short-lived and never sold or shared.
          </li>
          <li>
            <strong>Packs API.</strong> When you open the <RouterLink to="/packs" class="ink-link">Packs</RouterLink>
            page, your browser fetches read-only metadata about free sample packs. No personal data is sent.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">Audio files</h2>
        <p class="mt-2">
          All audio analysis (Key Finder, BPM Finder, EQ Visualizer, Note Tuner, Gain Meter,
          Sample Chopper, Bit Crusher, Metronome) runs locally via the Web Audio API. Your files are
          decoded into memory in your browser and discarded when you leave the page. They are not
          uploaded, copied or kept anywhere outside your machine.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">Contact form</h2>
        <p class="mt-2">
          If you reach out via <RouterLink to="/contact" class="ink-link">contact</RouterLink>, your
          email address and the message you write are used only to reply to you. They are not added
          to any list and not shared with anyone.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">Third-party hosts on the Packs page</h2>
        <p class="mt-2">
          Pack thumbnails are loaded directly from their original host (Reddit, archive.org,
          freesound.org, etc.). Those hosts will see a request from your browser when an image is
          fetched — same as any other site embedding external images. We don't control their privacy
          practices; check theirs if it matters to you.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">Your rights (GDPR)</h2>
        <p class="mt-2">
          Since we don't collect personal data beyond contact-form messages, there's not much to
          request — but you can ask for access to or deletion of any message you sent us by writing
          to <a :href="`mailto:${SITE_INFO.email}`" class="ink-link">{{ SITE_INFO.email }}</a>.
        </p>
      </section>
    </div>
  </div>
</template>
