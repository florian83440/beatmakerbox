// Fastify entry — boots HTTP server + schedules the aggregation cron.

import Fastify from 'fastify'
import cors from '@fastify/cors'
import cron from 'node-cron'
import { config } from './config.js'
import { getDb } from './db.js'
import { registerPacksRoutes } from './api/packs.js'
import { runAggregate } from './jobs/aggregate.js'

async function main(): Promise<void> {
  // Initialize DB / migrations eagerly so we crash early on a bad DB path.
  getDb()

  const app = Fastify({
    logger: {
      level: 'info',
      transport: process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty' },
    },
    disableRequestLogging: false,
  })

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow same-origin / curl / no-origin requests.
      if (!origin) return cb(null, true)
      if (config.corsOrigins.includes('*')) return cb(null, true)
      if (config.corsOrigins.includes(origin)) return cb(null, true)
      cb(new Error('Origin not allowed'), false)
    },
    methods: ['GET', 'OPTIONS'],
  })

  app.get('/api/healthz', async () => ({ status: 'ok', uptimeSec: process.uptime() }))

  await registerPacksRoutes(app)

  await app.listen({ port: config.port, host: config.host })
  app.log.info(`Listening on http://${config.host}:${config.port}`)

  // Cron schedule.
  if (cron.validate(config.aggregateCron)) {
    cron.schedule(config.aggregateCron, () => {
      app.log.info(`[cron] firing aggregate (${config.aggregateCron})`)
      runAggregate().catch((e) => app.log.error({ err: e }, '[cron] aggregate failed'))
    })
    app.log.info(`[cron] aggregate scheduled at "${config.aggregateCron}"`)
  } else {
    app.log.warn(`[cron] invalid AGGREGATE_CRON="${config.aggregateCron}" — not scheduled`)
  }

  if (config.aggregateOnBoot) {
    app.log.info('[boot] running initial aggregation')
    runAggregate().catch((e) => app.log.error({ err: e }, '[boot] aggregate failed'))
  }

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      app.log.info(`[shutdown] ${sig} received`)
      app.close().then(() => process.exit(0))
    })
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
