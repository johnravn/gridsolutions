#!/usr/bin/env node
/**
 * Link the Supabase CLI to Dev or Prod.
 * Usage: node scripts/supabase-link-target.js {dev|prod}
 *
 * Dev ref: SUPABASE_DEV_PROJECT_REF or .env.dev.db → SUPABASE_PROJECT_REF
 * Prod ref: fixed tlpgejkglrgoljgvpubn
 */

import { spawnSync } from 'child_process'
import {
  expectedRefForTarget,
  readLinkedProjectRef,
  PROD_PROJECT_REF,
} from './supabase-targets.mjs'

const target = process.argv[2]

if (target !== 'dev' && target !== 'prod') {
  console.error('Usage: node scripts/supabase-link-target.js {dev|prod}')
  process.exit(1)
}

let ref
try {
  ref = expectedRefForTarget(target)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

if (target === 'prod' && ref !== PROD_PROJECT_REF) {
  console.error(`Refusing to link Prod with unexpected ref: ${ref}`)
  process.exit(1)
}

const previous = readLinkedProjectRef()
console.log(
  previous
    ? `Currently linked: ${previous} → linking ${target} (${ref})`
    : `Linking ${target} (${ref})`,
)

const result = spawnSync('npx', ['supabase', 'link', '--project-ref', ref], {
  stdio: 'inherit',
  shell: false,
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log(`✓ CLI linked to ${target}: ${ref}`)
if (target === 'dev') {
  console.log('Safe next step (when John asks): npm run db:push:dev')
} else {
  console.log(
    'Prod link only. Do NOT db:push unless John explicitly asks. Then: CONFIRM_PROD_PUSH=1 npm run db:push:prod',
  )
}
