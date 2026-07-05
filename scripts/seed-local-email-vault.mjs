#!/usr/bin/env node
/**
 * Seeds vault secrets `project_url` + `anon_key` so pg_net (DB triggers + cron) can call Edge Functions.
 * Run automatically after `npm run db:reset:schema-only` when Supabase is up.
 *
 * Requires: Docker Supabase running (`supabase start`), `psql` on PATH.
 */

import { execFileSync, execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function escapeSqlLiteral(s) {
  return String(s).replace(/'/g, "''")
}

function upsertVaultSecret(dbUrl, name, value) {
  const v = escapeSqlLiteral(value)
  const n = escapeSqlLiteral(name)
  const sql = `
DO $$
DECLARE
  sid uuid;
BEGIN
  SELECT id INTO sid FROM vault.secrets WHERE name = '${n}' LIMIT 1;
  IF sid IS NOT NULL THEN
    PERFORM vault.update_secret(sid, '${v}');
  ELSE
    PERFORM vault.create_secret('${v}', '${n}');
  END IF;
END $$;
`
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: ['pipe', 'pipe', 'inherit'],
    encoding: 'utf8',
  })
}

function main() {
  let statusJson
  try {
    statusJson = execSync('npx supabase status -o json', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    console.warn(
      '[seed-local-email-vault] Skipped: `supabase status` failed (is `supabase start` running?).',
    )
    process.exit(0)
  }

  let s
  try {
    s = JSON.parse(statusJson)
  } catch {
    console.warn(
      '[seed-local-email-vault] Skipped: could not parse supabase status JSON.',
    )
    process.exit(0)
  }

  const dbUrl = s.DB_URL
  const anonKey = s.ANON_KEY
  const apiUrl = s.API_URL || 'http://127.0.0.1:54321'

  if (!dbUrl || !anonKey) {
    console.warn(
      '[seed-local-email-vault] Skipped: DB_URL or ANON_KEY missing from status.',
    )
    process.exit(0)
  }

  try {
    execFileSync('psql', ['--version'], { stdio: 'pipe' })
  } catch {
    console.warn(
      '[seed-local-email-vault] Skipped: psql not installed or not on PATH.',
    )
    process.exit(0)
  }

  const projectUrl = apiUrl.replace(
    /127\.0\.0\.1|localhost/gi,
    'host.docker.internal',
  )

  try {
    upsertVaultSecret(dbUrl, 'project_url', projectUrl)
    upsertVaultSecret(dbUrl, 'anon_key', anonKey)
    console.log(
      `[seed-local-email-vault] Vault secrets project_url + anon_key updated (project_url=${projectUrl}).`,
    )
  } catch (e) {
    console.warn(
      '[seed-local-email-vault] Failed to upsert vault secrets:',
      e?.message ?? e,
    )
    process.exit(0)
  }
}

main()
