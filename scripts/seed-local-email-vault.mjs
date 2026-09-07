#!/usr/bin/env node
/**
 * Seeds vault secrets `project_url`, `anon_key`, and `cron_secret` so pg_net
 * (DB triggers + cron) can call Edge Functions with CRON_SECRET.
 * Run automatically after `npm run db:reset:schema-only` when Supabase is up.
 *
 * Requires: Docker Supabase running (`supabase start`), `psql` on PATH.
 */

import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCAL_DEV_CRON_SECRET = 'local-dev-cron-secret'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readFunctionsEnvValue(name) {
  const envPath = join(root, 'supabase/functions/.env')
  if (!existsSync(envPath)) return null
  const text = readFileSync(envPath, 'utf8')
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`^\\s*${escaped}=(.*)$`, 'm'))
  if (!match) return null
  return match[1].trim().replace(/^["']|["']$/g, '')
}

function resolveCronSecret() {
  const fromEnv = process.env.CRON_SECRET?.trim()
  if (fromEnv) return fromEnv
  const fromFile = readFunctionsEnvValue('CRON_SECRET')
  if (fromFile) return fromFile
  return LOCAL_DEV_CRON_SECRET
}

function ensureFunctionsEnvCronSecret(cronSecret) {
  const envPath = join(root, 'supabase/functions/.env')
  if (!existsSync(envPath)) {
    console.warn(
      `[seed-local-email-vault] supabase/functions/.env missing — add CRON_SECRET=${cronSecret} so local Edge Functions accept pg_net.`,
    )
    return
  }
  if (readFunctionsEnvValue('CRON_SECRET')) return
  appendFileSync(envPath, `\nCRON_SECRET=${cronSecret}\n`)
  console.log(
    '[seed-local-email-vault] Appended CRON_SECRET to supabase/functions/.env (restart edge runtime if it is already running).',
  )
}

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
    const cronSecret = resolveCronSecret()
    upsertVaultSecret(dbUrl, 'project_url', projectUrl)
    upsertVaultSecret(dbUrl, 'anon_key', anonKey)
    upsertVaultSecret(dbUrl, 'cron_secret', cronSecret)
    ensureFunctionsEnvCronSecret(cronSecret)
    console.log(
      `[seed-local-email-vault] Vault secrets project_url + anon_key + cron_secret updated (project_url=${projectUrl}).`,
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
