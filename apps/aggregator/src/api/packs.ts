// HTTP routes for /api/packs.

import type { FastifyInstance } from 'fastify'
import { countByGenre, countByKind, countBySource, getPackBySlug, listPacks } from '../db.js'
import { sources } from '../sources/index.js'
import { GENRE_LABELS, KIND_LABELS, isKnownGenre, isKnownKind } from '../classify.js'
import type { SourceId } from '../types.js'

const KNOWN_SOURCES = new Set(sources.map((s) => s.id))

export async function registerPacksRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/packs', async (req, reply) => {
    const q = (req.query ?? {}) as Record<string, string | undefined>
    const limit = clampInt(q.limit, 1, 100, 24)
    const page = clampInt(q.page, 1, 1000, 1)
    const source = q.source && KNOWN_SOURCES.has(q.source as SourceId)
      ? (q.source as SourceId)
      : undefined
    const search = q.q?.trim() || undefined
    const kind = q.kind && isKnownKind(q.kind) ? q.kind : undefined
    const genre = q.genre && isKnownGenre(q.genre) ? q.genre : undefined

    const result = listPacks({
      source,
      q: search,
      kind,
      genre,
      limit,
      offset: (page - 1) * limit,
    })

    reply.header('Cache-Control', 'public, max-age=60')
    return {
      total: result.total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(result.total / limit)),
      packs: result.packs,
    }
  })

  app.get<{ Params: { slug: string } }>('/api/packs/:slug', async (req, reply) => {
    const pack = getPackBySlug(req.params.slug)
    if (!pack) {
      reply.status(404)
      return { error: 'pack not found' }
    }
    reply.header('Cache-Control', 'public, max-age=300')
    return { pack }
  })

  app.get('/api/sources', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=60')
    const counts = countBySource()
    const dict: Record<string, number> = {}
    for (const r of counts) dict[r.source] = r.count
    return {
      sources: sources.map((s) => ({
        id: s.id,
        label: s.label,
        count: dict[s.id] ?? 0,
      })),
    }
  })

  // Filter facets — the kinds and genres actually present in the DB, with
  // counts, so the frontend can render only meaningful filter chips.
  app.get('/api/facets', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=60')
    return {
      kinds: countByKind().map((k) => ({
        id: k.kind,
        label: KIND_LABELS[k.kind as keyof typeof KIND_LABELS] ?? k.kind,
        count: k.count,
      })),
      genres: countByGenre().map((g) => ({
        id: g.genre,
        label: GENRE_LABELS[g.genre] ?? g.genre,
        count: g.count,
      })),
    }
  })
}

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  if (!value) return fallback
  const n = parseInt(value, 10)
  if (isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
