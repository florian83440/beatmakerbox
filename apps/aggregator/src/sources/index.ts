// Source registry — one entry per external source.

import { fetchReddit } from './reddit.js'
import type { RawPack, SourceId } from '../types.js'

export interface Source {
  id: SourceId
  label: string
  fetch: () => Promise<RawPack[]>
}

export const sources: Source[] = [
  { id: 'reddit', label: 'Reddit', fetch: fetchReddit },
  // Phase 2 — placeholders, wired up next pass:
  // { id: 'freesound', label: 'Freesound.org', fetch: fetchFreesound },
  // { id: 'rss-cymatics', label: 'Cymatics RSS', fetch: fetchCymatics },
  // { id: 'rss-bvker', label: 'BVKER RSS', fetch: fetchBvker },
  // { id: 'youtube', label: 'YouTube Data API', fetch: fetchYoutube },
]
