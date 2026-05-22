// Internet Archive source — uses the public advancedsearch endpoint.
// No API key required.

import type { RawPack } from '../types.js'

const UA = 'beatmakerbox-aggregator/0.1 (+https://beatmakerbox)'

// Lucene-style queries against the IA index — audio items that look like
// producer material. Tweak / extend freely.
const QUERIES: ReadonlyArray<string> = [
  'mediatype:(audio) AND (subject:("drum kit") OR title:("drum kit"))',
  'mediatype:(audio) AND (subject:("sample pack") OR title:("sample pack"))',
  'mediatype:(audio) AND (subject:(loops) OR title:("loop kit"))',
]
const ROWS = 50

interface ArchiveDoc {
  identifier?: string
  title?: string | string[]
  creator?: string | string[]
  description?: string | string[]
  subject?: string | string[]
  publicdate?: string
  downloads?: number
}

export async function fetchArchive(): Promise<RawPack[]> {
  const out: RawPack[] = []
  const seen = new Set<string>()

  for (const q of QUERIES) {
    const params = new URLSearchParams()
    params.set('q', q)
    for (const f of ['identifier', 'title', 'creator', 'description', 'subject', 'publicdate', 'downloads']) {
      params.append('fl[]', f)
    }
    params.append('sort[]', 'publicdate desc')
    params.set('rows', String(ROWS))
    params.set('output', 'json')

    let docs: ArchiveDoc[]
    try {
      const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      })
      if (!res.ok) {
        console.warn(`[archive] query returned ${res.status}`)
        continue
      }
      const body = (await res.json()) as { response?: { docs?: ArchiveDoc[] } }
      docs = body.response?.docs ?? []
    } catch (e) {
      console.warn('[archive] fetch failed', e)
      continue
    }

    for (const d of docs) {
      if (!d.identifier || seen.has(d.identifier)) continue
      seen.add(d.identifier)
      const title = first(d.title)
      if (!title) continue
      const ts = d.publicdate ? Date.parse(d.publicdate) : NaN

      out.push({
        source: 'archive-org',
        sourceId: d.identifier,
        title,
        description: first(d.description)?.slice(0, 4000),
        url: `https://archive.org/details/${d.identifier}`,
        downloadUrl: `https://archive.org/download/${d.identifier}`,
        previewUrl: `https://archive.org/services/img/${d.identifier}`,
        author: first(d.creator),
        tags: list(d.subject),
        publishedAt: Number.isNaN(ts) ? undefined : Math.floor(ts / 1000),
        popularity: typeof d.downloads === 'number' ? d.downloads : undefined,
      })
    }
  }
  return out
}

/** IA fields are sometimes a bare string, sometimes an array. */
function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0] || undefined
  return v || undefined
}
function list(v: string | string[] | undefined): string[] | undefined {
  if (Array.isArray(v)) return v.length ? v : undefined
  return v ? [v] : undefined
}
