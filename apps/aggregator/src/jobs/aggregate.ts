// Aggregation job — iterate every registered source, fetch posts,
// upsert into SQLite. Designed to be idempotent and survive partial
// source failures (we don't bail out if one source goes 503).

import { upsertPacks } from '../db.js'
import { sources } from '../sources/index.js'

export interface AggregateReport {
  startedAt: number
  finishedAt: number
  durationMs: number
  perSource: Array<{
    source: string
    fetched: number
    inserted: number
    updated: number
    error?: string
  }>
  totalFetched: number
  totalInserted: number
  totalUpdated: number
}

export async function runAggregate(): Promise<AggregateReport> {
  const startedAt = Date.now()
  const perSource: AggregateReport['perSource'] = []
  let totalFetched = 0
  let totalInserted = 0
  let totalUpdated = 0

  for (const src of sources) {
    try {
      const t0 = Date.now()
      const fetched = await src.fetch()
      const { inserted, updated } = upsertPacks(fetched)
      const dt = Date.now() - t0
      perSource.push({ source: src.id, fetched: fetched.length, inserted, updated })
      totalFetched += fetched.length
      totalInserted += inserted
      totalUpdated += updated
      console.log(
        `[aggregate] ${src.id}: ${fetched.length} fetched, ${inserted} new, ${updated} updated (${dt}ms)`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      perSource.push({ source: src.id, fetched: 0, inserted: 0, updated: 0, error: msg })
      console.error(`[aggregate] ${src.id} failed: ${msg}`)
    }
  }

  const finishedAt = Date.now()
  return {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    perSource,
    totalFetched,
    totalInserted,
    totalUpdated,
  }
}

// Allow `pnpm aggregate` to invoke the job directly without booting Fastify.
const isDirectRun = process.argv[1]?.endsWith('aggregate.ts') ||
  process.argv[1]?.endsWith('aggregate.js')
if (isDirectRun) {
  runAggregate()
    .then((r) => {
      console.log('[aggregate] done', JSON.stringify(r, null, 2))
      process.exit(0)
    })
    .catch((e) => {
      console.error('[aggregate] fatal', e)
      process.exit(1)
    })
}
