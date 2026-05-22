// SQLite layer — uses Node's built-in `node:sqlite` (Node 22+, experimental).
// Zero native compilation, runs identically on Windows / Linux / macOS.

import { DatabaseSync, type StatementSync, type SQLInputValue } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.js'
import type { PackDto, PackRow, RawPack, SourceId } from './types.js'

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (db) return db
  mkdirSync(dirname(config.dbPath), { recursive: true })
  db = new DatabaseSync(config.dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  migrate(db)
  return db
}

function migrate(d: DatabaseSync): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS packs (
      slug          TEXT PRIMARY KEY,
      source        TEXT NOT NULL,
      source_id     TEXT NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT,
      url           TEXT NOT NULL,
      download_url  TEXT,
      preview_url   TEXT,
      author        TEXT,
      tags          TEXT,
      metadata      TEXT,
      published_at  INTEGER,
      fetched_at    INTEGER NOT NULL,
      popularity    INTEGER,
      estimated_bpm REAL,
      estimated_key TEXT,
      UNIQUE(source, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_packs_source       ON packs(source);
    CREATE INDEX IF NOT EXISTS idx_packs_published    ON packs(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_packs_popularity   ON packs(popularity DESC);
  `)
}

/** Convert a title to a stable URL slug. */
export function slugify(title: string, sourceId: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  let h = 0
  for (let i = 0; i < sourceId.length; i++) {
    h = ((h << 5) - h + sourceId.charCodeAt(i)) | 0
  }
  const short = (h >>> 0).toString(36).slice(0, 6)
  return base ? `${base}-${short}` : short
}

let _upsert: StatementSync | null = null
function upsertStatement(): StatementSync {
  if (_upsert) return _upsert
  _upsert = getDb().prepare(`
    INSERT INTO packs (
      slug, source, source_id, title, description, url, download_url,
      preview_url, author, tags, metadata, published_at, fetched_at, popularity
    )
    VALUES (
      $slug, $source, $source_id, $title, $description, $url, $download_url,
      $preview_url, $author, $tags, $metadata, $published_at, $fetched_at, $popularity
    )
    ON CONFLICT(source, source_id) DO UPDATE SET
      title        = excluded.title,
      description  = excluded.description,
      url          = excluded.url,
      download_url = excluded.download_url,
      preview_url  = excluded.preview_url,
      author       = excluded.author,
      tags         = excluded.tags,
      metadata     = excluded.metadata,
      popularity   = excluded.popularity
  `)
  return _upsert
}

export function upsertPacks(raws: RawPack[]): { inserted: number; updated: number } {
  if (raws.length === 0) return { inserted: 0, updated: 0 }
  const d = getDb()
  const stmt = upsertStatement()

  const countBefore = (d.prepare('SELECT COUNT(*) AS c FROM packs').get() as { c: number }).c

  d.exec('BEGIN')
  try {
    for (const r of raws) {
      stmt.run({
        $slug: slugify(r.title, `${r.source}:${r.sourceId}`),
        $source: r.source,
        $source_id: r.sourceId,
        $title: r.title,
        $description: r.description ?? null,
        $url: r.url,
        $download_url: r.downloadUrl ?? null,
        $preview_url: r.previewUrl ?? null,
        $author: r.author ?? null,
        $tags: r.tags && r.tags.length ? JSON.stringify(r.tags) : null,
        $metadata: r.metadata ? JSON.stringify(r.metadata) : null,
        $published_at: r.publishedAt ?? null,
        $fetched_at: Math.floor(Date.now() / 1000),
        $popularity: r.popularity ?? null,
      })
    }
    d.exec('COMMIT')
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }

  const countAfter = (d.prepare('SELECT COUNT(*) AS c FROM packs').get() as { c: number }).c
  const inserted = countAfter - countBefore
  const updated = raws.length - inserted
  return { inserted, updated }
}

// ---------------------------------------------------------------------------

export interface ListQuery {
  source?: SourceId
  q?: string
  limit: number
  offset: number
}

export interface ListResult {
  total: number
  packs: PackDto[]
}

export function listPacks(query: ListQuery): ListResult {
  const d = getDb()
  const where: string[] = []
  const params: Record<string, SQLInputValue> = {}
  if (query.source) {
    where.push('source = $source')
    params.$source = query.source
  }
  if (query.q) {
    where.push('(title LIKE $q OR description LIKE $q OR author LIKE $q)')
    params.$q = `%${query.q}%`
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = (d
    .prepare(`SELECT COUNT(*) AS c FROM packs ${whereSql}`)
    .get(params) as { c: number }).c

  const rows = d
    .prepare(`
      SELECT * FROM packs
      ${whereSql}
      ORDER BY COALESCE(published_at, fetched_at) DESC
      LIMIT $limit OFFSET $offset
    `)
    .all({ ...params, $limit: query.limit, $offset: query.offset }) as unknown as PackRow[]

  return {
    total,
    packs: rows.map(rowToDto),
  }
}

export function getPackBySlug(slug: string): PackDto | null {
  const row = getDb().prepare('SELECT * FROM packs WHERE slug = ?').get(slug) as PackRow | undefined
  return row ? rowToDto(row) : null
}

export function countBySource(): Array<{ source: SourceId; count: number }> {
  const rows = getDb()
    .prepare('SELECT source, COUNT(*) AS count FROM packs GROUP BY source ORDER BY count DESC')
    .all() as unknown as Array<{ source: SourceId; count: number }>
  return rows
}

function rowToDto(row: PackRow): PackDto {
  return {
    slug: row.slug,
    source: row.source,
    title: row.title,
    description: row.description,
    url: row.url,
    downloadUrl: row.download_url,
    previewUrl: row.preview_url,
    author: row.author,
    tags: row.tags ? safeJsonArray(row.tags) : [],
    metadata: row.metadata ? safeJsonObject(row.metadata) : {},
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    popularity: row.popularity,
    estimatedBpm: row.estimated_bpm,
    estimatedKey: row.estimated_key,
  }
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

function safeJsonObject(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch { return {} }
}
