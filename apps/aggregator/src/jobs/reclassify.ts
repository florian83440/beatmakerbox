// One-off job — re-derive kind + genres for every stored pack using the
// current classify.ts rule tables. Run after editing the keyword rules:
//
//   pnpm reclassify
//
// (New packs are classified automatically at upsert time; this only exists
// to retro-apply rule changes to the existing corpus without re-fetching.)

import { reclassifyAll } from '../db.js'

try {
  const n = reclassifyAll()
  console.log(`[reclassify] re-classified ${n} pack(s)`)
  process.exit(0)
} catch (e) {
  console.error('[reclassify] failed', e)
  process.exit(1)
}
