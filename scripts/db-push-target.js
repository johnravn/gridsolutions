#!/usr/bin/env node
/**
 * Push migrations to Dev or Prod only after verifying the CLI link.
 *
 * Usage:
 *   npm run db:push:dev
 *   CONFIRM_PROD_PUSH=1 npm run db:push:prod
 *
 * Hard rule: agents must not run db:push:prod unless John explicitly asks.
 * db:push:dev is for John (or an agent he explicitly authorizes for Dev only).
 */

import { spawnSync } from 'child_process'
import {
  expectedRefForTarget,
  readLinkedProjectRef,
  PROD_PROJECT_REF,
} from './supabase-targets.mjs'

const target = process.argv[2]

if (target !== 'dev' && target !== 'prod') {
  console.error('Usage: node scripts/db-push-target.js {dev|prod}')
  process.exit(1)
}

if (target === 'prod' && process.env.CONFIRM_PROD_PUSH !== '1') {
  console.error(
    'Refusing Prod push. John owns Prod. To proceed only when John asked:\n  CONFIRM_PROD_PUSH=1 npm run db:push:prod',
  )
  process.exit(1)
}

let expected
try {
  expected = expectedRefForTarget(target)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const linked = readLinkedProjectRef()
if (!linked) {
  console.error(`CLI is not linked. Run: npm run supabase:link:${target}`)
  process.exit(1)
}

if (linked !== expected) {
  console.error(
    `Linked project is ${linked}, but ${target} expects ${expected}.\n` +
      `Run: npm run supabase:link:${target}`,
  )
  process.exit(1)
}

if (target === 'prod' && linked !== PROD_PROJECT_REF) {
  console.error(`Safety check failed: linked ${linked} is not Prod.`)
  process.exit(1)
}

console.log(`Pushing migrations to ${target} (${linked})…`)
const result = spawnSync('npx', ['supabase', 'db', 'push'], {
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status ?? 1)
