<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useHead } from '@unhead/vue'
import { getPack, type PackDto } from '@/lib/packsApi'

const route = useRoute()
const pack = ref<PackDto | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
let controller: AbortController | null = null

const slug = computed(() => String(route.params.slug ?? ''))

async function load(): Promise<void> {
  if (controller) controller.abort()
  controller = new AbortController()
  isLoading.value = true
  error.value = null
  pack.value = null
  try {
    pack.value = await getPack(slug.value, controller.signal)
    if (!pack.value) error.value = 'Pack not found'
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    error.value = e instanceof Error ? e.message : 'Failed to load'
  } finally {
    isLoading.value = false
  }
}

watch(slug, () => { void load() })
onMounted(() => { void load() })
onBeforeUnmount(() => { if (controller) controller.abort() })

useHead(() => ({
  title: pack.value
    ? `${pack.value.title} — Free sample pack · Beatmakerbox`
    : 'Sample pack · Beatmakerbox',
  meta: [
    {
      name: 'description',
      content: pack.value
        ? (pack.value.description?.slice(0, 160) ??
           `Free sample pack from ${pack.value.source}. Browse details, get the original source link.`)
        : 'Free sample pack — Beatmakerbox.',
    },
  ],
}))

function formatDate(unix: number | null): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const sourceLabel: Record<string, string> = {
  'reddit': 'Reddit',
  'freesound': 'Freesound.org',
  'rss-cymatics': 'Cymatics',
  'rss-bvker': 'BVKER',
  'rss-producerspot': 'ProducerSpot',
  'rss-cr2': 'Cr2 Records',
  'youtube': 'YouTube',
  'archive-org': 'Internet Archive',
  'bandcamp': 'Bandcamp',
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <RouterLink to="/packs" class="ink-link text-sm">← Back to all packs</RouterLink>

    <div v-if="isLoading" class="panel mt-6 animate-pulse p-8">
      <div class="h-6 w-1/3 rounded bg-[var(--color-surface-3)]"></div>
      <div class="mt-3 h-4 w-2/3 rounded bg-[var(--color-surface-3)]"></div>
      <div class="mt-2 h-4 w-1/2 rounded bg-[var(--color-surface-3)]"></div>
    </div>

    <div
      v-else-if="error"
      class="panel-flat mt-6 border-l-2 border-l-[var(--color-magenta)] px-4 py-3 text-sm text-[var(--color-magenta)]"
    >
      {{ error }}
    </div>

    <article v-else-if="pack" class="mt-6 space-y-5">
      <header class="panel p-6 sm:p-8">
        <div class="mb-3 flex items-center gap-2">
          <span class="chip" style="color: var(--color-emerald); border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.14);">
            {{ sourceLabel[pack.source] ?? pack.source }}
          </span>
          <span v-if="pack.popularity !== null" class="chip">▲ {{ pack.popularity }}</span>
          <span class="mono ml-auto text-[10px] text-[var(--color-text-muted)]">
            Published {{ formatDate(pack.publishedAt) }}
          </span>
        </div>
        <h1 class="text-balance text-3xl font-bold leading-tight sm:text-4xl">{{ pack.title }}</h1>
        <p v-if="pack.author" class="mono mt-2 text-sm text-[var(--color-text-muted)]">
          by {{ pack.author }}
        </p>
      </header>

      <div v-if="pack.description" class="panel p-6">
        <p class="label mb-3">Description</p>
        <p class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-soft)]">
          {{ pack.description }}
        </p>
      </div>

      <div class="panel p-6">
        <p class="label mb-3">Links</p>
        <div class="flex flex-wrap gap-3">
          <a
            :href="pack.url"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-primary"
            :style="{ background: 'var(--color-emerald)', color: '#0a0a0a' }"
          >
            Open on {{ sourceLabel[pack.source] ?? pack.source }} →
          </a>
          <a
            v-if="pack.downloadUrl"
            :href="pack.downloadUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-ghost"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Direct download
          </a>
        </div>
      </div>

      <div v-if="pack.tags.length > 0" class="panel p-6">
        <p class="label mb-3">Tags</p>
        <div class="flex flex-wrap gap-2">
          <span v-for="tag in pack.tags" :key="tag" class="chip">{{ tag }}</span>
        </div>
      </div>

      <!-- Future: BPM / key auto-detected by enrich job -->
      <div v-if="pack.estimatedBpm || pack.estimatedKey" class="panel p-6">
        <p class="label mb-3">Auto-analysis</p>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div v-if="pack.estimatedBpm">
            <p class="label !text-[9px]">Tempo</p>
            <p class="mono mt-1 text-base text-[var(--color-text)]">{{ pack.estimatedBpm.toFixed(1) }} BPM</p>
          </div>
          <div v-if="pack.estimatedKey">
            <p class="label !text-[9px]">Key</p>
            <p class="mono mt-1 text-base text-[var(--color-text)]">{{ pack.estimatedKey }}</p>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>
