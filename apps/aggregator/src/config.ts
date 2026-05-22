// Centralized config loader. Reads from process.env once at startup.

import process from 'node:process'

// Load a local .env for development. Harmless when the file is absent or when
// the variables are already injected (Docker uses compose `env_file`).
// process.loadEnvFile is built-in (Node 20.12+) — no dotenv dependency.
try {
  process.loadEnvFile()
} catch {
  /* no .env file present — fall back to the real environment */
}

function env(name: string, fallback?: string): string {
  const v = process.env[name]
  if (v === undefined || v === '') {
    if (fallback === undefined) throw new Error(`Missing env var: ${name}`)
    return fallback
  }
  return v
}

function envList(name: string, fallback: string[] = []): string[] {
  const v = process.env[name]
  if (!v) return fallback
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]
  if (v === undefined) return fallback
  return v === 'true' || v === '1' || v === 'yes'
}

export const config = {
  port: parseInt(env('PORT', '3002'), 10),
  host: env('HOST', '0.0.0.0'),
  corsOrigins: envList('CORS_ORIGINS', ['http://localhost:5173']),
  dbPath: env('DB_PATH', './data/aggregator.db'),
  redditSubs: envList('REDDIT_SUBS', ['Drumkits', 'freedrums']),
  redditUserAgent: env('REDDIT_USER_AGENT', 'beatmakerbox-aggregator/0.1'),
  // Optional API keys — when empty, the matching source stays unregistered.
  freesoundApiKey: env('FREESOUND_API_KEY', ''),
  youtubeApiKey: env('YOUTUBE_API_KEY', ''),
  aggregateCron: env('AGGREGATE_CRON', '17 3 * * *'),
  aggregateOnBoot: envBool('AGGREGATE_ON_BOOT', false),
}
