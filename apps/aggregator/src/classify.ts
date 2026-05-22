// Heuristic classifier.
//
// The sources give us no structured category — only a free-text title and
// a few tags (subreddit, flair). This keyword pass derives a single "kind"
// (the pack type) and a set of genres, run once at upsert time and stored
// in dedicated columns so the API can filter on them cheaply.
//
// Tweak the rule tables below and run `pnpm reclassify` to re-apply them to
// the whole DB without re-fetching.

export type PackKind =
  | 'drum-kit'
  | '808'
  | 'loop-kit'
  | 'one-shots'
  | 'sample-pack'
  | 'preset-pack'
  | 'midi'
  | 'vocals'

/** Display labels. Object key order also defines facet display order. */
export const KIND_LABELS: Record<PackKind, string> = {
  'drum-kit':    'Drum Kits',
  '808':         '808s',
  'loop-kit':    'Loop Kits',
  'one-shots':   'One-Shots',
  'sample-pack': 'Sample Packs',
  'preset-pack': 'Presets / VST',
  'midi':        'MIDI',
  'vocals':      'Vocals',
}

// Kind is single-valued — first rule that matches wins, so order matters:
// specific signals first, the generic "kit / pack" catch-all last.
const KIND_RULES: ReadonlyArray<readonly [PackKind, RegExp]> = [
  ['808',         /\b808s?\b/],
  ['one-shots',   /\bone[\s-]?shots?\b/],
  ['midi',        /\bmidi\b/],
  ['preset-pack', /\bpresets?\b|\bserum\b|\bvstis?\b|\bvst\b|\bpatch(?:es)?\b|\bsylenth\b|\bbank\b/],
  ['vocals',      /\bac+a?pell?as?\b|\bvocals?\b|\bad[\s-]?libs?\b|\btoplines?\b/],
  ['loop-kit',    /\bloops?\b|\bmelod(?:y|ies|ic)\b/],
  ['drum-kit',    /\bdrum[\s-]?kits?\b|\bdrums?\b|\bfreedrums?\b|\bpercussions?\b/],
  ['sample-pack', /\bsamples?\b|\bsound[\s-]?kits?\b|\bkits?\b|\bpacks?\b/],
]

/** Display labels. Object key order also defines facet display order. */
export const GENRE_LABELS: Record<string, string> = {
  'trap':        'Trap',
  'drill':       'Drill',
  'hip-hop':     'Hip-Hop',
  'boom-bap':    'Boom Bap',
  'lo-fi':       'Lo-Fi',
  'rnb':         'R&B',
  'phonk':       'Phonk',
  'plugg':       'Plugg',
  'house':       'House',
  'techno':      'Techno',
  'edm':         'EDM',
  'dnb':         'DnB',
  'dubstep':     'Dubstep',
  'afrobeat':    'Afrobeat',
  'amapiano':    'Amapiano',
  'reggaeton':   'Reggaeton',
  'jersey-club': 'Jersey Club',
  'hyperpop':    'Hyperpop',
  'future-bass': 'Future Bass',
  'pop':         'Pop',
  'rock':        'Rock',
  'jazz':        'Jazz',
  'soul':        'Soul',
  'ambient':     'Ambient',
}

// Genre is multi-valued — every rule that matches is added.
const GENRE_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ['trap',        /\btrap\b/],
  ['drill',       /\bdrill\b/],
  ['boom-bap',    /\bboom[\s-]?bap\b/],
  ['lo-fi',       /\blo[\s-]?fi\b/],
  ['phonk',       /\bphonk\b/],
  ['plugg',       /\bpluggn?b?\b/],
  ['hip-hop',     /\bhip[\s-]?hop\b|\brap\b/],
  ['rnb',         /\br&b\b|\brnb\b|\brhythm and blues\b/],
  ['dnb',         /\bdnb\b|\bd&b\b|\bdrum\s*(?:and|n|&|'n')\s*bass\b|\bjungle\b/],
  ['house',       /\bhouse\b/],
  ['techno',      /\btechno\b/],
  ['dubstep',     /\bdubstep\b|\briddim\b|\bbrostep\b/],
  ['edm',         /\bedm\b|\belectro\b/],
  ['amapiano',    /\bamapiano\b/],
  ['afrobeat',    /\bafro[\s-]?beats?\b|\bafro\b/],
  ['reggaeton',   /\breggaeton\b|\bdembow\b/],
  ['jersey-club', /\bjersey[\s-]?club\b/],
  ['hyperpop',    /\bhyper[\s-]?pop\b/],
  ['future-bass', /\bfuture[\s-]?bass\b/],
  ['ambient',     /\bambient\b|\bcinematic\b/],
  ['jazz',        /\bjazz\b/],
  ['soul',        /\bsoul\b|\bgospel\b|\bmotown\b/],
  ['rock',        /\brock\b|\bmetal\b|\bpunk\b/],
  ['pop',         /\bpop\b/],
]

export interface Classification {
  kind: PackKind | null
  genres: string[]
}

/**
 * Classify a pack from its title + tags. Description is intentionally left
 * out — it adds far more genre false-positives than signal.
 */
export function classify(title: string, tags: string[] = []): Classification {
  const hay = ` ${title} ${tags.join(' ')} `.toLowerCase()

  let kind: PackKind | null = null
  for (const [k, re] of KIND_RULES) {
    if (re.test(hay)) { kind = k; break }
  }

  const genres: string[] = []
  for (const [g, re] of GENRE_RULES) {
    if (re.test(hay)) genres.push(g)
  }

  return { kind, genres }
}

/** Whitelist guards for the API — reject unknown filter values. */
export function isKnownKind(v: string): v is PackKind {
  return Object.prototype.hasOwnProperty.call(KIND_LABELS, v)
}
export function isKnownGenre(v: string): boolean {
  return Object.prototype.hasOwnProperty.call(GENRE_LABELS, v)
}
