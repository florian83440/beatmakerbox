// Freesound source — Freesound APIv2 text search.
//
// Requires a free API token (FREESOUND_API_KEY). Apply at:
//   https://freesound.org/apiv2/apply/
// When no key is set the source isn't registered (see sources/index.ts), so
// this fetcher's empty-key guard is only a defensive fallback.
//
// Freesound results are individual sounds — each is treated as a one-shot /
// loop entry. `url` points to the freesound.org page (download happens there).

import { config } from '../config.js'
import type { RawPack } from '../types.js'

const QUERIES: ReadonlyArray<string> = ['drum loop', 'drum one shot', '808 bass', 'percussion loop']
const PAGE_SIZE = 30
const FIELDS = 'id,name,description,url,license,previews,images,username,tags,created,num_downloads'

interface FsSound {
  id: number
  name?: string
  description?: string
  url?: string
  license?: string
  previews?: Record<string, string>
  images?: Record<string, string>
  username?: string
  tags?: string[]
  created?: string
  num_downloads?: number
}

export async function fetchFreesound(): Promise<RawPack[]> {
  const key = config.freesoundApiKey
  if (!key) return []

  const out: RawPack[] = []
  const seen = new Set<number>()

  for (const q of QUERIES) {
    const params = new URLSearchParams({
      query: q,
      page_size: String(PAGE_SIZE),
      sort: 'created_desc',
      fields: FIELDS,
      token: key,
    })

    let results: FsSound[]
    try {
      const res = await fetch(`https://freesound.org/apiv2/search/text/?${params}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        console.warn(`[freesound] "${q}" returned ${res.status}`)
        continue
      }
      const body = (await res.json()) as { results?: FsSound[] }
      results = body.results ?? []
    } catch (e) {
      console.warn('[freesound] fetch failed', e)
      continue
    }

    for (const s of results) {
      if (!s.name || !s.url || seen.has(s.id)) continue
      seen.add(s.id)
      const ts = s.created ? Date.parse(s.created) : NaN
      // previewUrl stays an image (the waveform render); the playable mp3
      // goes in metadata.audioPreview for the detail-page audio player.
      const audioPreview = s.previews?.['preview-hq-mp3'] ?? s.previews?.['preview-lq-mp3']

      // Freesound API ToU: each sound must be credited per its license.
      const metadata: Record<string, unknown> = {}
      if (audioPreview) metadata.audioPreview = audioPreview
      if (s.license) metadata.license = s.license

      out.push({
        source: 'freesound',
        sourceId: String(s.id),
        title: s.name,
        description: s.description?.slice(0, 4000),
        // No downloadUrl — the user lands on the Freesound page to download,
        // which keeps attribution + licensing intact (ToU).
        url: s.url,
        previewUrl: s.images?.['waveform_m'] ?? s.images?.['waveform_l'],
        author: s.username,
        tags: s.tags?.length ? s.tags : undefined,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        publishedAt: Number.isNaN(ts) ? undefined : Math.floor(ts / 1000),
        popularity: typeof s.num_downloads === 'number' ? s.num_downloads : undefined,
      })
    }
  }
  return out
}
