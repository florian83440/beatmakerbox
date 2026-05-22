<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { useHead } from '@unhead/vue'
import { listPacks, listSources, listFacets, type PackDto, type SourceInfo, type FacetItem } from '@/lib/packsApi'

useHead({
  title: 'Free Sample Packs — Daily aggregator · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Browse free sample packs, drum kits, loops and 808s aggregated daily from Reddit, Freesound, producer blogs and YouTube. Filter by source, search by name.' },
    { property: 'og:title', content: 'Free Sample Packs — Daily aggregator' },
    { property: 'og:description', content: 'Free sample packs aggregated from Reddit, Freesound, blogs and YouTube. New packs every day.' },
    { property: 'og:type', content: 'website' },
  ],
})

const packs = ref<PackDto[]>([])
const total = ref(0)
const pages = ref(1)
const page = ref(1)
const limit = 24
const sources = ref<SourceInfo[]>([])
const activeSource = ref<string | null>(null)
const kinds = ref<FacetItem[]>([])
const genres = ref<FacetItem[]>([])
const activeKind = ref<string | null>(null)
const activeGenre = ref<string | null>(null)
const query = ref('')
const debouncedQuery = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const errorKind = ref<'unreachable' | 'api' | null>(null)

// Slugs whose thumbnail failed to load — fall back to the placeholder.
const broken = reactive(new Set<string>())

let activeController: AbortController | null = null
let debounceHandle: number | null = null

watch(query, (v) => {
  if (debounceHandle !== null) clearTimeout(debounceHandle)
  debounceHandle = window.setTimeout(() => {
    debouncedQuery.value = v.trim()
    page.value = 1
  }, 280)
})

async function fetchData(): Promise<void> {
  if (activeController) activeController.abort()
  activeController = new AbortController()
  isLoading.value = true
  error.value = null
  errorKind.value = null
  try {
    const result = await listPacks({
      page: page.value,
      limit,
      source: activeSource.value ?? undefined,
      kind: activeKind.value ?? undefined,
      genre: activeGenre.value ?? undefined,
      q: debouncedQuery.value || undefined,
      signal: activeController.signal,
    })
    packs.value = result.packs
    total.value = result.total
    pages.value = result.pages
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    const msg = e instanceof Error ? e.message : 'Failed to load packs'
    if (msg === 'aggregator_unreachable') {
      errorKind.value = 'unreachable'
    } else {
      errorKind.value = 'api'
    }
    error.value = msg
  } finally {
    isLoading.value = false
  }
}

watch([page, activeSource, activeKind, activeGenre, debouncedQuery], () => { void fetchData() })

onMounted(async () => {
  // Sources + facets are best-effort — the grid still works without them.
  try {
    const [src, facets] = await Promise.all([listSources(), listFacets()])
    sources.value = src
    kinds.value = facets.kinds
    genres.value = facets.genres
  } catch { /* ignore */ }
  await fetchData()
})

onBeforeUnmount(() => {
  if (activeController) activeController.abort()
  if (debounceHandle !== null) clearTimeout(debounceHandle)
})

function selectSource(src: string | null): void {
  activeSource.value = src
  page.value = 1
}

function selectKind(k: string | null): void {
  activeKind.value = k
  page.value = 1
}

function selectGenre(g: string | null): void {
  activeGenre.value = g
  page.value = 1
}

function kindLabel(id: string | null): string {
  if (!id) return ''
  return kinds.value.find((k) => k.id === id)?.label ?? id
}

function formatDate(unix: number | null): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function sourceLabel(id: string): string {
  return sources.value.find((s) => s.id === id)?.label ?? id
}

function sourceAccent(id: string): string {
  // Tone-mapped per source — keeps the FL-style multi-color identity.
  const map: Record<string, string> = {
    'reddit': 'var(--color-accent)',
    'freesound': 'var(--color-cyan)',
    'youtube': 'var(--color-magenta)',
    'archive-org': 'var(--color-teal)',
    'bandcamp': 'var(--color-violet)',
    'rss-bpb': 'var(--color-lime)',
    'rss-4drumkits': 'var(--color-yellow)',
  }
  return map[id] ?? 'var(--color-text-soft)'
}

const hasFilters = computed(() =>
  activeSource.value !== null ||
  activeKind.value !== null ||
  activeGenre.value !== null ||
  debouncedQuery.value.length > 0,
)

function resetFilters(): void {
  activeSource.value = null
  activeKind.value = null
  activeGenre.value = null
  query.value = ''
  debouncedQuery.value = ''
  page.value = 1
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(16,185,129,0.14); border-color: rgba(16,185,129,0.3); color: var(--color-emerald);">tool · 07</span>
        <span class="chip">aggregated daily</span>
        <span class="chip">{{ total }} packs</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        Free Sample <span class="text-[var(--color-emerald)]">Packs</span>
      </h1>
      <p class="max-w-2xl text-[var(--color-text-soft)]">
        Drum kits, loops, 808s and one-shots aggregated daily from Reddit,
        Freesound, producer blogs and YouTube. Filter, search, click through to the original source.
      </p>
    </header>

    <!-- Toolbar: search + source chips -->
    <div class="panel mb-3 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" stroke-linecap="round" />
        </svg>
        <input
          v-model="query"
          type="search"
          placeholder="Search packs, e.g. trap, lo-fi, drill, 808..."
          class="w-full rounded-md border border-[var(--color-edge)] bg-[var(--color-surface-2)] py-2 pl-9 pr-3 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-emerald)] focus:outline-none"
        />
      </div>
      <button
        v-if="hasFilters"
        type="button"
        class="btn-ghost text-xs"
        @click="resetFilters"
      >
        Reset filters
      </button>
    </div>

    <!-- Source filter chips -->
    <div class="panel mb-3 flex flex-wrap items-center gap-2 p-3">
      <span class="label mr-2">Source</span>
      <button
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
        :class="activeSource === null
          ? 'border-[var(--color-text)] bg-[var(--color-text)]/10 text-[var(--color-text)]'
          : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
        @click="selectSource(null)"
      >
        All
      </button>
      <button
        v-for="src in sources"
        :key="src.id"
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
        :class="activeSource === src.id
          ? 'border-[var(--color-text)] bg-[var(--color-text)]/10 text-[var(--color-text)]'
          : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
        :style="activeSource === src.id ? `color: ${sourceAccent(src.id)}; border-color: ${sourceAccent(src.id)};` : ''"
        @click="selectSource(src.id)"
      >
        {{ src.label }}
        <span class="mono ml-1 text-[10px] opacity-70">{{ src.count }}</span>
      </button>
    </div>

    <!-- Type filter chips -->
    <div v-if="kinds.length" class="panel mb-3 flex flex-wrap items-center gap-2 p-3">
      <span class="label mr-2">Type</span>
      <button
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
        :class="activeKind === null
          ? 'border-[var(--color-text)] bg-[var(--color-text)]/10 text-[var(--color-text)]'
          : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
        @click="selectKind(null)"
      >
        All
      </button>
      <button
        v-for="k in kinds"
        :key="k.id"
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
        :class="activeKind === k.id
          ? 'border-[var(--color-emerald)] bg-[var(--color-emerald)]/12 text-[var(--color-emerald)]'
          : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
        @click="selectKind(k.id)"
      >
        {{ k.label }}
        <span class="mono ml-1 text-[10px] opacity-70">{{ k.count }}</span>
      </button>
    </div>

    <!-- Genre filter chips -->
    <div v-if="genres.length" class="panel mb-3 flex flex-wrap items-center gap-2 p-3">
      <span class="label mr-2">Genre</span>
      <button
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
        :class="activeGenre === null
          ? 'border-[var(--color-text)] bg-[var(--color-text)]/10 text-[var(--color-text)]'
          : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
        @click="selectGenre(null)"
      >
        All
      </button>
      <button
        v-for="g in genres"
        :key="g.id"
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
        :class="activeGenre === g.id
          ? 'border-[var(--color-emerald)] bg-[var(--color-emerald)]/12 text-[var(--color-emerald)]'
          : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
        @click="selectGenre(g.id)"
      >
        {{ g.label }}
        <span class="mono ml-1 text-[10px] opacity-70">{{ g.count }}</span>
      </button>
    </div>

    <div
      v-if="error"
      class="panel mb-4 border-l-2 border-l-[var(--color-magenta)] px-5 py-4"
    >
      <!-- Aggregator not running locally -->
      <template v-if="errorKind === 'unreachable'">
        <p class="text-sm font-semibold text-[var(--color-magenta)]">Aggregator not reachable</p>
        <p class="mt-1 text-sm text-[var(--color-text-soft)]">
          The packs API is unavailable. In development, start the aggregator in a second terminal:
        </p>
        <pre class="screen mono mt-3 overflow-x-auto px-4 py-3 text-xs text-[var(--color-text)]">cd apps/aggregator
cp .env.example .env   # first time only
pnpm dev               # listens on :3002, proxied by Vite</pre>
        <p class="mt-3 text-xs text-[var(--color-text-muted)]">
          In production, set <code class="mono">VITE_PACKS_API_URL</code> to your aggregator origin at build time.
        </p>
      </template>

      <!-- API returned an unexpected HTTP error -->
      <template v-else>
        <p class="text-sm font-semibold text-[var(--color-magenta)]">API error ({{ error }})</p>
        <p class="mt-1 text-sm text-[var(--color-text-soft)]">
          The aggregator responded with an unexpected error. Check the server logs.
        </p>
      </template>
    </div>

    <!-- Skeleton while loading + empty state -->
    <div v-if="isLoading && packs.length === 0" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="panel h-72 animate-pulse"></div>
    </div>

    <div v-else-if="!isLoading && packs.length === 0" class="panel py-16 text-center">
      <p class="text-[var(--color-text-soft)]">No packs match your filters.</p>
      <button v-if="hasFilters" type="button" class="btn-ghost mt-4" @click="resetFilters">
        Reset filters
      </button>
    </div>

    <!-- Grid -->
    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="pack in packs"
        :key="pack.slug"
        :to="`/packs/${pack.slug}`"
        class="panel group relative flex flex-col overflow-hidden transition-all hover:-translate-y-0.5"
      >
        <!-- Thumbnail -->
        <div class="aspect-[16/9] w-full overflow-hidden border-b border-[var(--color-edge-soft)] bg-[var(--color-bg-2)]">
          <img
            v-if="pack.previewUrl && !broken.has(pack.slug)"
            :src="pack.previewUrl"
            alt=""
            loading="lazy"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            @error="broken.add(pack.slug)"
          />
          <div v-else class="flex h-full w-full items-center justify-center">
            <svg class="h-8 w-8 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        <div class="flex flex-1 flex-col p-4">
          <div class="mb-2 flex items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-1.5">
              <span
                class="truncate text-[11px] font-semibold"
                :style="{ color: sourceAccent(pack.source) }"
              >
                {{ sourceLabel(pack.source) }}
              </span>
              <span
                v-if="pack.kind"
                class="shrink-0 rounded border border-[var(--color-edge-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-soft)]"
              >
                {{ kindLabel(pack.kind) }}
              </span>
            </span>
            <span class="mono shrink-0 text-[10px] text-[var(--color-text-muted)]">
              {{ formatDate(pack.publishedAt) }}
            </span>
          </div>

          <h3 class="line-clamp-2 text-base font-semibold leading-snug text-[var(--color-text)] group-hover:text-[var(--color-emerald)]">
            {{ pack.title }}
          </h3>

          <p v-if="pack.description" class="mt-2 line-clamp-2 flex-1 text-sm text-[var(--color-text-soft)]">
            {{ pack.description }}
          </p>
          <p v-else class="mt-2 flex-1 text-sm text-[var(--color-text-muted)] italic">
            No description
          </p>

          <div class="mt-3 flex items-center justify-between text-xs">
            <span v-if="pack.author" class="mono truncate text-[var(--color-text-muted)]">{{ pack.author }}</span>
            <span v-if="pack.popularity !== null" class="mono shrink-0 text-[var(--color-text-muted)]">
              ▲ {{ pack.popularity }}
            </span>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Pagination -->
    <div v-if="pages > 1" class="mt-6 flex items-center justify-center gap-2">
      <button
        type="button"
        class="btn-ghost"
        :disabled="page <= 1"
        @click="page--"
      >
        ← Prev
      </button>
      <span class="mono px-3 text-sm text-[var(--color-text-soft)]">
        {{ page }} / {{ pages }}
      </span>
      <button
        type="button"
        class="btn-ghost"
        :disabled="page >= pages"
        @click="page++"
      >
        Next →
      </button>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
