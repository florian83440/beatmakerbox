// Thin fetcher for the @beatmakerbox/aggregator HTTP API.
//
// The base URL is configured via the VITE_PACKS_API_URL env var (Vite
// inlines it at build time). When unset, we hit "/api" (same-origin) so a
// dev proxy can route to the aggregator without rebuilding.

export interface PackDto {
  slug: string
  source: string
  title: string
  description: string | null
  url: string
  downloadUrl: string | null
  previewUrl: string | null
  author: string | null
  tags: string[]
  metadata: Record<string, unknown>
  publishedAt: number | null
  fetchedAt: number
  popularity: number | null
  estimatedBpm: number | null
  estimatedKey: string | null
}

export interface PacksListResponse {
  total: number
  page: number
  limit: number
  pages: number
  packs: PackDto[]
}

export interface SourceInfo {
  id: string
  label: string
  count: number
}

const RAW_BASE = (import.meta.env.VITE_PACKS_API_URL ?? '/api').replace(/\/$/, '')

export interface ListPacksParams {
  source?: string
  q?: string
  page?: number
  limit?: number
  signal?: AbortSignal
}

export async function listPacks(params: ListPacksParams = {}): Promise<PacksListResponse> {
  const u = new URL(`${RAW_BASE}/packs`, window.location.origin)
  if (params.source) u.searchParams.set('source', params.source)
  if (params.q) u.searchParams.set('q', params.q)
  if (params.page) u.searchParams.set('page', String(params.page))
  if (params.limit) u.searchParams.set('limit', String(params.limit))

  const res = await fetch(u.toString(), { signal: params.signal })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as PacksListResponse
}

export async function getPack(slug: string, signal?: AbortSignal): Promise<PackDto | null> {
  const u = `${RAW_BASE}/packs/${encodeURIComponent(slug)}`
  const res = await fetch(u, { signal })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API ${res.status}`)
  const body = (await res.json()) as { pack: PackDto }
  return body.pack
}

export async function listSources(signal?: AbortSignal): Promise<SourceInfo[]> {
  const res = await fetch(`${RAW_BASE}/sources`, { signal })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const body = (await res.json()) as { sources: SourceInfo[] }
  return body.sources
}
