// YouTube source — YouTube Data API v3.
//
// Requires an API key (YOUTUBE_API_KEY). Create one at:
//   https://console.cloud.google.com/  → enable "YouTube Data API v3"
// When no key is set the source isn't registered (see sources/index.ts).
//
// Filtering strategy — search.list returns way too much noise (vlogs,
// tutorials, type-beat uploads that just mention "kit"). A video is kept
// only when ALL of the following hold:
//   1. Title carries a pack-style noun (kit / pack / loop / bank / …)
//      and isn't a tutorial / reaction / vlog.
//   2. Title or the first chunk of the description says it's free.
//   3. A direct download URL exists — first in the FULL description, else
//      in the top-relevance comments. Without a download link we can't
//      actually fetch the pack, so the video is dropped.
// The found URL is stored as `downloadUrl` so the detail page surfaces it
// behind a "Direct download" button.

import { config } from '../config.js'
import { decodeEntities } from './rss.js'
import type { RawPack } from '../types.js'

const QUERIES: ReadonlyArray<string> = [
  // English (international producer scene)
  'free drum kit',
  'free sample pack',
  'free loop kit',
  'free 808 kit',
  // French producer scene (YSOS, Mxney, etc.)
  'drum kit gratuit',
  'sample pack gratuit',
  'kit gratuit type beat',
]
const MAX_RESULTS = 25
const FREE_PROBE_CHARS = 800

const TYPE_RE = /\b(kits?|packs?|loops?|samples?|sounds?|bank|preset|stems?|drumkit)\b/i
const FREE_RE = /\b(free|gratuit|libre|gratis)\b/i
const NEG_RE  = /\b(tutorial|tuto|how[\s-]?to|reaction|review|making[\s-]?of|behind the scenes|breakdown|vlog|beat tape|comment faire)\b/i
const URL_RE  = /https?:\/\/[^\s)"'<>]+/g
const DL_HOST_RE =
  /(drive\.google|dropbox|mega\.nz|mediafire|gofile|gumroad|linktr|beacons\.ai|hypeddit|sellfy|payhip|airbit|fanlink|wetransfer|smarturl|smartlink|landr|distrokid|trakstar|drumkits)/i

interface SearchItem {
  id?: { videoId?: string }
}
interface VideoItem {
  id?: string
  snippet?: {
    title?: string
    description?: string
    channelTitle?: string
    publishedAt?: string
    thumbnails?: Record<string, { url?: string } | undefined>
  }
}
interface CommentThread {
  snippet?: {
    topLevelComment?: {
      snippet?: { textOriginal?: string; textDisplay?: string }
    }
  }
}

export async function fetchYoutube(): Promise<RawPack[]> {
  const key = config.youtubeApiKey
  if (!key) return []

  const out: RawPack[] = []
  const seen = new Set<string>()
  let totalSeen = 0
  let totalKept = 0

  for (const q of QUERIES) {
    // 1. Search — collect candidate video IDs.
    let ids: string[]
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        order: 'date',
        maxResults: String(MAX_RESULTS),
        q,
        key,
      })
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        console.warn(`[youtube] search "${q}" returned ${res.status}`)
        continue
      }
      const body = (await res.json()) as { items?: SearchItem[] }
      ids = (body.items ?? [])
        .map((i) => i.id?.videoId)
        .filter((v): v is string => !!v)
    } catch (e) {
      console.warn('[youtube] search failed', e)
      continue
    }
    if (ids.length === 0) continue
    totalSeen += ids.length

    // 2. videos.list returns the FULL description (search.list truncates it),
    //    which we need for the download-link scan.
    let videos: VideoItem[]
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        id: ids.join(','),
        key,
      })
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        console.warn(`[youtube] videos.list returned ${res.status}`)
        continue
      }
      const body = (await res.json()) as { items?: VideoItem[] }
      videos = body.items ?? []
    } catch (e) {
      console.warn('[youtube] videos.list failed', e)
      continue
    }

    // 3. Filter to actual pack releases with a real download link.
    for (const v of videos) {
      const vid = v.id
      const sn = v.snippet
      if (!vid || !sn?.title || seen.has(vid)) continue
      const title = decodeEntities(sn.title)
      const description = sn.description ? decodeEntities(sn.description) : ''

      // (a) title shape + free signal
      if (!TYPE_RE.test(title) || NEG_RE.test(title)) continue
      if (!FREE_RE.test(title) && !FREE_RE.test(description.slice(0, FREE_PROBE_CHARS))) continue

      // (b) download link — description first, then top comments.
      let downloadUrl = findDownloadUrl(description)
      if (!downloadUrl) downloadUrl = await findDownloadUrlInComments(vid, key)
      if (!downloadUrl) continue

      seen.add(vid)
      totalKept++
      const ts = sn.publishedAt ? Date.parse(sn.publishedAt) : NaN
      const thumb = sn.thumbnails ?? {}

      out.push({
        source: 'youtube',
        sourceId: vid,
        title,
        description: description.slice(0, 4000),
        url: `https://www.youtube.com/watch?v=${vid}`,
        downloadUrl,
        previewUrl: thumb.high?.url ?? thumb.medium?.url ?? thumb.default?.url,
        author: sn.channelTitle,
        publishedAt: Number.isNaN(ts) ? undefined : Math.floor(ts / 1000),
      })
    }
  }

  if (totalSeen > 0) {
    console.log(`[youtube] kept ${totalKept} of ${totalSeen} search results after release filter`)
  }
  return out
}

/** Find a download-host URL anywhere in a free-form text. */
function findDownloadUrl(text: string): string | undefined {
  const urls = text.match(URL_RE)
  return urls?.find((u) => DL_HOST_RE.test(u))
}

/**
 * Fallback: scan the top relevance comments for a download URL. Producers
 * routinely pin / drop the link there when the description got cut short.
 * Gracefully returns undefined when comments are disabled or the call fails.
 */
async function findDownloadUrlInComments(videoId: string, key: string): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      videoId,
      order: 'relevance',
      maxResults: '5',
      key,
    })
    const res = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return undefined
    const body = (await res.json()) as { items?: CommentThread[] }
    for (const item of body.items ?? []) {
      const c = item.snippet?.topLevelComment?.snippet
      const text = c?.textOriginal ?? c?.textDisplay ?? ''
      const dl = findDownloadUrl(decodeEntities(text))
      if (dl) return dl
    }
  } catch {
    /* swallow — comments off, rate-limited, etc. */
  }
  return undefined
}
