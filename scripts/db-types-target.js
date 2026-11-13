#!/usr/bin/env node
/**
 * Generate TypeScript types from hosted Dev or Prod.
 * Usage: node scripts/db-types-target.js {dev|prod}
 */

import { spawnSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { expectedRefForTarget, ROOT } from './supabase-targets.mjs'

const target = process.argv[2]

if (target !== 'dev' && target !== 'prod') {
  console.error('Usage: node scripts/db-types-target.js {dev|prod}')
  process.exit(1)
}

let projectId
try {
  projectId = expectedRefForTarget(target)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const outPath = join(ROOT, 'src/shared/types/database.types.ts')
console.log(`Generating types from ${target} (${projectId}) → ${outPath}`)

const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', projectId],
  { encoding: 'utf-8', shell: false },
)

if (result.status !== 0) {
  if (result.stderr) process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

writeFileSync(outPath, result.stdout)
console.log(`✓ Wrote ${outPath}`)
