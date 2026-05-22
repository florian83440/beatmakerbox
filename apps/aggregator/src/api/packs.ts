// HTTP routes for /api/packs.

import type { FastifyInstance } from 'fastify'
import { countBySource, getPackBySlug, listPacks } from '../db.js'
import { sources } from '../sources/index.js'
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

    const result = listPacks({
      source,
      q: search,
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
}

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  if (!value) return fallback
  const n = parseInt(value, 10)
  if (isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
