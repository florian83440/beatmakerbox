// Reddit source — uses the public JSON endpoint, no auth.
//
// We poll `/r/<sub>/new.json` for each configured subreddit, normalize the
// posts into RawPack and let the aggregator deduplicate by (source, source_id).

import { config } from '../config.js'
import type { RawPack } from '../types.js'

interface RedditChild {
  data: {
    id: string
    name: string
    subreddit: string
    title: string
    selftext: string
    author: string
    url: string
    permalink: string
    thumbnail: string
    preview?: { images: Array<{ source: { url: string } }> }
    created_utc: number
    ups: number
    over_18: boolean
    stickied: boolean
    is_self: boolean
    link_flair_text: string | null
    media: unknown
  }
}

interface RedditListing {
  data: { children: RedditChild[] }
}

/**
 * Heuristic — keep posts that look like sample packs / drum kits. Reddit's
 * sub-specific posting culture makes the "title contains kit/pack/loop/free"
 * filter very high-recall.
 */
function looksLikePack(title: string, selftext: string): boolean {
  const t = `${title}\n${selftext}`.toLowerCase()
  if (/(\bkit\b|\bpack\b|\bloops?\b|\bsamples?\b|\bdrums?\b|\boneshots?\b|\bvst\b|\bvsti\b)/.test(t)) {
    return true
  }
  // r/Drumkits, r/freedrums are kit-only — keep everything that isn't a meta post.
  return false
}

export async function fetchReddit(): Promise<RawPack[]> {
  const subs = config.redditSubs
  const ua = config.redditUserAgent
  const all: RawPack[] = []

  for (const sub of subs) {
    const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/new.json?limit=75`
    let listing: RedditListing
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'application/json',
        },
      })
      if (!res.ok) {
        console.warn(`[reddit] r/${sub} returned ${res.status}`)
        continue
      }
      listing = (await res.json()) as RedditListing
    } catch (e) {
      console.warn(`[reddit] r/${sub} fetch failed`, e)
      continue
    }

    const subIsKitFocused = sub === 'Drumkits' || sub === 'freedrums'

    for (const c of listing.data?.children ?? []) {
      const d = c.data
      if (d.over_18 || d.stickied) continue

      const title = d.title?.trim() ?? ''
      if (!title) continue
      if (!subIsKitFocused && !looksLikePack(title, d.selftext ?? '')) continue

      const previewUrl =
        d.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ??
        (d.thumbnail && d.thumbnail.startsWith('http') ? d.thumbnail : undefined)

      const downloadUrl = looksLikeDownloadLink(d.url) ? d.url : undefined

      all.push({
        source: 'reddit',
        sourceId: d.name,                                   // "t3_xxxxxx" — globally unique
        title,
        description: d.selftext ? d.selftext.slice(0, 4000) : undefined,
        url: `https://reddit.com${d.permalink}`,
        downloadUrl,
        previewUrl,
        author: d.author ? `u/${d.author}` : undefined,
        tags: d.link_flair_text ? [d.link_flair_text, sub] : [sub],
        metadata: {
          subreddit: d.subreddit,
          isSelf: d.is_self,
          linkUrl: d.is_self ? null : d.url,
        },
        publishedAt: d.created_utc,
        popularity: d.ups,
      })
    }
  }

  return all
}

function looksLikeDownloadLink(url: string): boolean {
  if (!url) return false
  return /\.(zip|rar|7z|wav|mp3|flac)(\?|$)/i.test(url) ||
    /(drive\.google|dropbox|mega\.nz|mediafire|gofile)/i.test(url)
}
