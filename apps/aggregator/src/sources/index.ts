// Source registry — one entry per external source.
//
// Reddit, Internet Archive and the RSS blogs need no credentials and are
// always active. Freesound and YouTube are only registered when their API
// key is configured, so the aggregator never calls a source it can't use.

import { config } from '../config.js'
import { fetchReddit } from './reddit.js'
import { fetchArchive } from './archive.js'
import { fetchFreesound } from './freesound.js'
import { fetchYoutube } from './youtube.js'
import { RSS_FEEDS, fetchRss } from './rss.js'
import type { RawPack, SourceId } from '../types.js'

export interface Source {
  id: SourceId
  label: string
  fetch: () => Promise<RawPack[]>
}

export const sources: Source[] = [
  { id: 'reddit', label: 'Reddit', fetch: fetchReddit },
  { id: 'archive-org', label: 'Internet Archive', fetch: fetchArchive },

  // One source per curated RSS feed.
  ...RSS_FEEDS.map((f): Source => ({
    id: f.id,
    label: f.label,
    fetch: () => fetchRss(f.id, f.url),
  })),

  // Key-gated — registered only when an API key is present.
  ...(config.freesoundApiKey
    ? [{ id: 'freesound' as SourceId, label: 'Freesound', fetch: fetchFreesound }]
    : []),
  ...(config.youtubeApiKey
    ? [{ id: 'youtube' as SourceId, label: 'YouTube', fetch: fetchYoutube }]
    : []),
]
