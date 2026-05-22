// Shared types between sources, jobs, db and API.

/** Identifier of an external source. RSS feeds use the `rss-<slug>` form. */
export type SourceId =
  | 'reddit'
  | 'freesound'
  | 'youtube'
  | 'archive-org'
  | 'bandcamp'
  | `rss-${string}`

/** Output of a source fetcher — normalized into a common shape. */
export interface RawPack {
  source: SourceId
  /** Stable source-side ID (e.g. reddit post id). */
  sourceId: string
  title: string
  description?: string
  /** URL of the original post/page (where the user lands first). */
  url: string
  /** Direct download URL if known (zip, etc.). Often null. */
  downloadUrl?: string
  /** Preview image, audio sample or video embed. */
  previewUrl?: string
  /** Author / submitter name. */
  author?: string
  /** Tags / categories already known from the source. */
  tags?: string[]
  /** Free-form metadata kept per-source for the detail page. */
  metadata?: Record<string, unknown>
  /** Unix epoch (seconds) of original publication, if known. */
  publishedAt?: number
  /** Source-side popularity hint (upvotes, view count, etc.). */
  popularity?: number
}

/** Row stored in SQLite. */
export interface PackRow {
  slug: string
  source: SourceId
  source_id: string
  title: string
  description: string | null
  url: string
  download_url: string | null
  preview_url: string | null
  author: string | null
  tags: string | null          // JSON
  metadata: string | null      // JSON
  published_at: number | null
  fetched_at: number
  popularity: number | null
  estimated_bpm: number | null
  estimated_key: string | null
  kind: string | null          // classified pack type
  genres: string | null        // JSON array of classified genres
}

/** Pack as exposed on the public API (decoded JSON fields, camelCase). */
export interface PackDto {
  slug: string
  source: SourceId
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
  /** Classified pack type — see classify.ts. Null when nothing matched. */
  kind: string | null
  /** Classified genres — possibly empty. */
  genres: string[]
}
