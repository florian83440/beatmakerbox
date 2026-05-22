<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useHead } from '@unhead/vue'
import { SITE_INFO } from '@/lib/siteInfo'

useHead({
  title: 'Terms of Service — Beatmakerbox',
  meta: [
    { name: 'description', content: 'Terms governing your use of Beatmakerbox.' },
    { name: 'robots', content: 'index, follow' },
  ],
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
    <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Terms of Service</h1>
    <p class="mt-2 text-sm text-[var(--color-text-muted)]">
      Last updated: {{ SITE_INFO.legalUpdated }}
    </p>

    <div class="mt-10 space-y-8 text-[var(--color-text-soft)] leading-relaxed">
      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">1. Acceptance</h2>
        <p class="mt-2">
          By using Beatmakerbox, you agree to these Terms. If you don't agree, don't use the site.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">2. What Beatmakerbox is</h2>
        <p class="mt-2">
          Beatmakerbox is a free collection of in-browser audio tools (key detection, BPM detection,
          EQ, metronome, sample chopper, etc.) plus an aggregator of free sample packs collected from
          public third-party sources.
        </p>
        <p class="mt-2">
          Every audio analysis runs locally in your browser via the Web Audio API. The files you load
          in the tools are <strong>never uploaded</strong> to any server.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">3. Your responsibility</h2>
        <p class="mt-2">
          You are responsible for the audio you load in the tools. Don't process content you don't
          have the right to use.
        </p>
        <p class="mt-2">
          The Packs page links to material hosted by third parties (Reddit, Internet Archive, blog
          feeds, Freesound, YouTube, etc.). Each item's license is defined by its original publisher.
          Read the license shown on the pack page — and the source's own terms — before using anything.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">4. Third-party licenses</h2>
        <p class="mt-2">
          Aggregated content remains under its original license. In particular, sounds from
          <a href="https://freesound.org" target="_blank" rel="noopener noreferrer" class="ink-link">Freesound</a>
          are usable only under the Creative Commons license attached to each sound, and the Freesound
          API is restricted to <strong>non-commercial use</strong>.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">5. No warranty</h2>
        <p class="mt-2">
          Beatmakerbox is provided <em>as is</em>, without warranty of any kind, express or implied.
          The tools are best-effort: detected keys, BPMs, loudness values and the like may be wrong.
          Don't rely on them for anything safety-critical.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">6. Liability</h2>
        <p class="mt-2">
          To the maximum extent permitted by law, Beatmakerbox is not liable for any direct, indirect,
          incidental or consequential damages arising from your use of the site or of the content
          linked from it.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">7. Changes</h2>
        <p class="mt-2">
          These Terms may change. The current version always lives at this URL. Continued use of the
          site after a change means you accept the new Terms.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[var(--color-text)]">8. Contact</h2>
        <p class="mt-2">
          Questions? <RouterLink to="/contact" class="ink-link">Get in touch</RouterLink>.
        </p>
      </section>
    </div>
  </div>
</template>
