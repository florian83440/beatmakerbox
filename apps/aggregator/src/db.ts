// SQLite layer — uses Node's built-in `node:sqlite` (Node 22+, experimental).
// Zero native compilation, runs identically on Windows / Linux / macOS.

import { DatabaseSync, type StatementSync, type SQLInputValue } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.js'
import { classify } from './classify.js'
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
      kind          TEXT,
      genres        TEXT,
      UNIQUE(source, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_packs_source       ON packs(source);
    CREATE INDEX IF NOT EXISTS idx_packs_published    ON packs(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_packs_popularity   ON packs(popularity DESC);
  `)

  // Incremental columns — added to pre-existing databases that predate the
  // classifier. New databases already get them from the CREATE above.
  // Must run before the kind index, which references the column.
  addColumnIfMissing(d, 'kind', 'TEXT')
  addColumnIfMissing(d, 'genres', 'TEXT')
  d.exec('CREATE INDEX IF NOT EXISTS idx_packs_kind ON packs(kind)')

  // Backfill: classify rows that have never been classified.
  const done = runClassification(d, true)
  if (done > 0) console.log(`[db] classified ${done} existing pack(s)`)
}

/** Add a column to the packs table only if it isn't there yet. */
function addColumnIfMissing(d: DatabaseSync, column: string, type: string): void {
  const cols = d.prepare('PRAGMA table_info(packs)').all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    d.exec(`ALTER TABLE packs ADD COLUMN ${column} ${type}`)
  }
}

/**
 * (Re)derive kind + genres for stored packs. `onlyMissing` restricts it to
 * rows never classified — used for the migration backfill; the full sweep
 * backs `reclassifyAll()` / `pnpm reclassify`.
 */
function runClassification(d: DatabaseSync, onlyMissing: boolean): number {
  const rows = d
    .prepare(`SELECT slug, title, tags FROM packs${onlyMissing ? ' WHERE kind IS NULL' : ''}`)
    .all() as Array<{ slug: string; title: string; tags: string | null }>
  if (rows.length === 0) return 0

  const upd = d.prepare('UPDATE packs SET kind = $kind, genres = $genres WHERE slug = $slug')
  d.exec('BEGIN')
  try {
    for (const r of rows) {
      const c = classify(r.title, r.tags ? safeJsonArray(r.tags) : [])
      upd.run({
        $slug: r.slug,
        $kind: c.kind,
        $genres: c.genres.length ? JSON.stringify(c.genres) : null,
      })
    }
    d.exec('COMMIT')
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
  return rows.length
}

/** Re-classify every stored pack with the current rule tables. */
export function reclassifyAll(): number {
  return runClassification(getDb(), false)
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
      preview_url, author, tags, metadata, published_at, fetched_at, popularity,
      kind, genres
    )
    VALUES (
      $slug, $source, $source_id, $title, $description, $url, $download_url,
      $preview_url, $author, $tags, $metadata, $published_at, $fetched_at, $popularity,
      $kind, $genres
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
      popularity   = excluded.popularity,
      kind         = excluded.kind,
      genres       = excluded.genres
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
      const c = classify(r.title, r.tags ?? [])
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
        $kind: c.kind,
        $genres: c.genres.length ? JSON.stringify(c.genres) : null,
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
  kind?: string
  genre?: string
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
  if (query.kind) {
    where.push('kind = $kind')
    params.$kind = query.kind
  }
  if (query.genre) {
    // genres is a JSON array string — match the quoted token inside it.
    where.push('genres LIKE $genre')
    params.$genre = `%"${query.genre}"%`
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

export function countByKind(): Array<{ kind: string; count: number }> {
  return getDb()
    .prepare(`
      SELECT kind, COUNT(*) AS count FROM packs
      WHERE kind IS NOT NULL
      GROUP BY kind ORDER BY count DESC
    `)
    .all() as unknown as Array<{ kind: string; count: number }>
}

export function countByGenre(): Array<{ genre: string; count: number }> {
  // genres is a JSON array per row — tally in JS to stay independent of the
  // SQLite JSON extension.
  const rows = getDb()
    .prepare('SELECT genres FROM packs WHERE genres IS NOT NULL')
    .all() as unknown as Array<{ genres: string }>
  const tally = new Map<string, number>()
  for (const r of rows) {
    for (const g of safeJsonArray(r.genres)) {
      tally.set(g, (tally.get(g) ?? 0) + 1)
    }
  }
  return [...tally.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
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
    kind: row.kind,
    genres: row.genres ? safeJsonArray(row.genres) : [],
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
