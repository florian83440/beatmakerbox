// Generic RSS 2.0 / Atom source.
//
// Dependency-free parser — feeds are regular enough that a small regex
// extractor beats pulling in an XML library (the project deliberately avoids
// heavy / native deps). Best-effort: a malformed or blocked feed yields [].
//
// To add a blog: drop a { id, label, url } entry in RSS_FEEDS below. The id
// must start with "rss-". The aggregator picks it up on next boot.

import type { RawPack, SourceId } from '../types.js'

export interface RssFeed {
  id: SourceId
  label: string
  url: string
}

/** Curated feed list. Add verified feeds here. */
export const RSS_FEEDS: ReadonlyArray<RssFeed> = [
  {
    id: 'rss-bpb',
    label: 'Bedroom Producers Blog',
    url: 'https://bedroomproducersblog.com/feed/',
  },
  {
    // Producer-pack aggregator (drum kits, loop kits, Serum banks). Catches
    // FR producers like YSOS / Mxney when their kits land here.
    id: 'rss-4drumkits',
    label: '4drumkits',
    url: 'https://4drumkits.com/feed/',
  },
]

const UA = 'beatmakerbox-aggregator/0.1 (+https://beatmakerbox)'

// Feeds carry news / deals / unrelated posts — keep only sample-ish items.
const RELEVANT =
  /\b(samples?|sound[\s-]?(?:kits?|banks?|fonts?)|drum[\s-]?kits?|drums?|loops?|808s?|one[\s-]?shots?|presets?|patch(?:es)?|acapellas?|vocals?|midi|soundfonts?|kits?|banks?|serum|sylenth|stems?)\b/i

export async function fetchRss(sourceId: SourceId, url: string): Promise<RawPack[]> {
  let xml: string
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    })
    if (!res.ok) {
      console.warn(`[rss] ${sourceId} returned ${res.status}`)
      return []
    }
    xml = await res.text()
  } catch (e) {
    console.warn(`[rss] ${sourceId} fetch failed`, e)
    return []
  }

  let blocks = extractBlocks(xml, 'item')
  if (blocks.length === 0) blocks = extractBlocks(xml, 'entry')

  const out: RawPack[] = []
  for (const block of blocks) {
    const rawTitle = innerTag(block, 'title')
    if (!rawTitle) continue
    const title = decodeEntities(rawTitle)

    const link = innerTag(block, 'link') ?? attrTag(block, 'link', 'href')
    if (!link) continue

    const categories = allInnerTags(block, 'category').map(decodeEntities)
    if (!RELEVANT.test(`${title} ${categories.join(' ')}`)) continue

    const rawDesc =
      innerTag(block, 'content:encoded') ??
      innerTag(block, 'description') ??
      innerTag(block, 'summary') ??
      innerTag(block, 'content') ??
      ''

    const guid = innerTag(block, 'guid') ?? innerTag(block, 'id') ?? link
    const dateStr =
      innerTag(block, 'pubDate') ?? innerTag(block, 'published') ?? innerTag(block, 'updated')
    const ts = dateStr ? Date.parse(dateStr) : NaN

    out.push({
      source: sourceId,
      sourceId: decodeEntities(guid),
      title,
      description: rawDesc ? stripHtml(rawDesc).slice(0, 4000) || undefined : undefined,
      url: decodeEntities(link),
      previewUrl: firstImage(rawDesc),
      author: orUndef(decodeEntities(innerTag(block, 'dc:creator') ?? innerTag(block, 'author') ?? '')),
      tags: categories.length ? categories : undefined,
      publishedAt: Number.isNaN(ts) ? undefined : Math.floor(ts / 1000),
    })
  }
  return out
}

// --- tiny XML helpers ------------------------------------------------------

/** All inner contents of <tag>…</tag> occurrences. */
function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1])
  return out
}

/** Inner text of the first <tag>…</tag>, CDATA-unwrapped and trimmed. */
function innerTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!m) return undefined
  return orUndef(stripCdata(m[1]).trim())
}

function allInnerTags(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    const v = stripCdata(m[1]).trim()
    if (v) out.push(v)
  }
  return out
}

/** Value of an attribute on the first <tag …attr="…"> — for Atom <link href>. */
function attrTag(block: string, tag: string, attr: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return m ? decodeEntities(m[1]) : undefined
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function codePoint(cp: number): string {
  try { return String.fromCodePoint(cp) } catch { return '' }
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function firstImage(html: string): string | undefined {
  const m = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i)
  return m ? decodeEntities(m[1]) : undefined
}

function orUndef(s: string): string | undefined {
  return s ? s : undefined
}
