#!/usr/bin/env node
/**
 * Runs `supabase db reset` with SUPABASE_DB_ONLY=true, then bucket sync + vault seed.
 *
 * The CLI often exits non-zero with "502" during "Restarting containers..." even though
 * migrations + seed.sql already finished (supabase/cli#4535). When that happens we verify
 * the latest migration version exists in supabase_migrations.schema_migrations and continue.
 */

import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function readDbPort() {
  try {
    const cfg = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8')
    const m = cfg.match(/^\s*port\s*=\s*(\d+)/m)
    if (m) return m[1]
  } catch {
    /* ignore */
  }
  return '54322'
}

function latestMigrationVersionFromDisk() {
  const migDir = path.join(root, 'supabase/migrations')
  const names = fs.readdirSync(migDir)
  const versions = names
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .map((f) => f.slice(0, 14))
  if (versions.length === 0) return null
  return versions.sort().at(-1)
}

function maxAppliedMigrationVersion(dbUrl) {
  try {
    const out = execFileSync(
      'psql',
      [
        dbUrl,
        '-tAc',
        'select max(version) from supabase_migrations.schema_migrations;',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim()
    return out || null
  } catch {
    return null
  }
}

function recoveryLooksGood(expectedLatest, appliedMax) {
  if (!expectedLatest || !appliedMax) return false
  return appliedMax.length === 14 && appliedMax >= expectedLatest
}

const dbUrl = `postgresql://postgres:postgres@127.0.0.1:${readDbPort()}/postgres`

const reset = spawnSync('supabase', ['db', 'reset'], {
  cwd: root,
  env: { ...process.env, SUPABASE_DB_ONLY: 'true' },
  stdio: 'inherit',
  shell: false,
})

function followUp() {
  const r1 = spawnSync('npm', ['run', 'db:sync-buckets'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })
  if (r1.status !== 0) process.exit(r1.status ?? 1)
  const r2 = spawnSync('npm', ['run', 'db:seed-email-vault-local'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })
  process.exit(r2.status ?? 0)
}

if (reset.status === 0) {
  followUp()
}

const expected = latestMigrationVersionFromDisk()
const applied = maxAppliedMigrationVersion(dbUrl)

if (recoveryLooksGood(expected, applied)) {
  console.warn('')
  console.warn(
    '\x1b[33m⚠️  supabase db reset reported an error (often HTTP 502 while restarting Docker services).\x1b[0m',
  )
  console.warn(
    `\x1b[33m   Latest migration on disk (${expected}) is applied in Postgres (${applied}) — continuing with bucket sync + vault seed.\x1b[0m`,
  )
  console.warn(
    '\x1b[36m   If REST or Studio misbehave: supabase stop && supabase start\x1b[0m',
  )
  console.warn('')
  followUp()
}

console.error('')
console.error(
  '\x1b[31mdb reset failed and could not verify migrations (install `psql` or fix Docker).\x1b[0m',
)
console.error(
  applied
    ? `Expected latest migration ${expected ?? '(unknown)'}; DB reports max ${applied}.`
    : 'Could not read supabase_migrations.schema_migrations via psql.',
)
console.error('')
process.exit(reset.status ?? 1)
