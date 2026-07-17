#!/usr/bin/env node
/**
 * Copy authentication users from remote Supabase to local
 * This copies auth.users and auth.identities so you can log in locally
 * Usage: node scripts/copy-auth.js
 */

import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkLocalRunning() {
  try {
    execSync('docker ps | grep supabase_db_grid', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function copyAuth() {
  log('🔐 Copying authentication users from remote to local...', 'blue')
  console.log('')

  // Check if local Supabase is running
  if (!checkLocalRunning()) {
    log('❌ Local Supabase is not running.', 'red')
    log('   Start it with: npm run supabase:start', 'yellow')
    process.exit(1)
  }

  // Step 1: Dump auth schema from remote
  log('1️⃣  Dumping auth data from remote database...', 'cyan')
  const tempFile = join(tmpdir(), `supabase_auth_${Date.now()}.sql`)

  try {
    // Dump auth schema (users, identities, but skip sessions/refresh_tokens).
    // Keep stderr out of the SQL file so CLI notices don't break the filter.
    execSync(
      `npx supabase db dump --linked --schema auth --data-only > "${tempFile}"`,
      { stdio: ['ignore', 'pipe', 'inherit'] },
    )
  } catch (error) {
    // Check if it's just a warning or actual error
    const fs = await import('fs')
    if (!existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
      log('❌ Failed to dump auth data from remote.', 'red')
      log("   Make sure you're linked: npm run supabase:link", 'yellow')
      if (existsSync(tempFile)) unlinkSync(tempFile)
      process.exit(1)
    }
  }

  // Check if dump has content
  const fs = await import('fs')
  if (!existsSync(tempFile)) {
    log('❌ Auth dump file was not created.', 'red')
    process.exit(1)
  }

  const stats = fs.statSync(tempFile)
  if (stats.size === 0) {
    log('⚠️  Auth dump appears to be empty.', 'yellow')
    log(
      '   This might mean there are no users in remote, or auth schema is restricted.',
      'yellow',
    )
    if (existsSync(tempFile)) unlinkSync(tempFile)
    return
  }

  // Read and filter the dump to only include users and identities
  // Skip sessions, refresh_tokens, audit_log_entries, etc.
  log('2️⃣  Processing auth data...', 'cyan')
  const dumpContent = fs.readFileSync(tempFile, 'utf-8')

  // Filter to only include INSERT statements for users and identities.
  // Newer dumps quote identifiers: INSERT INTO "auth"."users" (...)
  const normalizeInsertTarget = (line) =>
    line
      .toUpperCase()
      .replace(/"/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const lines = dumpContent.split('\n')
  const filteredLines = []
  let inUsersInsert = false
  let inIdentitiesInsert = false
  let currentInsert = []

  for (const line of lines) {
    const trimmed = line.trim()
    const normalized = normalizeInsertTarget(trimmed)

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('--')) {
      continue
    }

    // Detect INSERT INTO auth.users (quoted or unquoted)
    if (normalized.startsWith('INSERT INTO AUTH.USERS')) {
      inUsersInsert = true
      inIdentitiesInsert = false
      currentInsert = [line]
      continue
    }

    // Detect INSERT INTO auth.identities (quoted or unquoted)
    if (normalized.startsWith('INSERT INTO AUTH.IDENTITIES')) {
      inIdentitiesInsert = true
      inUsersInsert = false
      currentInsert = [line]
      continue
    }

    // Skip other INSERT statements (sessions, refresh_tokens, audit_log_entries, etc.)
    if (normalized.startsWith('INSERT INTO')) {
      inUsersInsert = false
      inIdentitiesInsert = false
      currentInsert = []
      continue
    }

    // Skip SET, SELECT, and other statements
    if (
      trimmed.startsWith('SET ') ||
      trimmed.startsWith('SELECT ') ||
      trimmed.startsWith('\\')
    ) {
      continue
    }

    // Continue INSERT statement if we're in one
    if (inUsersInsert || inIdentitiesInsert) {
      currentInsert.push(line)
      // End of INSERT statement (single- or multi-row)
      if (trimmed.endsWith(';')) {
        filteredLines.push(...currentInsert)
        filteredLines.push('') // Add blank line
        currentInsert = []
        inUsersInsert = false
        inIdentitiesInsert = false
      }
    }
  }

  // Finish any remaining INSERT
  if (currentInsert.length > 0) {
    filteredLines.push(...currentInsert)
  }

  if (filteredLines.length === 0) {
    log('⚠️  No auth users found in remote database.', 'yellow')
    if (existsSync(tempFile)) unlinkSync(tempFile)
    return
  }

  // Write filtered content to temp file (idempotent if users already exist)
  const filteredFile = join(
    tmpdir(),
    `supabase_auth_filtered_${Date.now()}.sql`,
  )
  const filteredSql = filteredLines
    .join('\n')
    .replace(/;\s*$/gm, '\nON CONFLICT DO NOTHING;')
  writeFileSync(filteredFile, filteredSql, 'utf-8')

  // Step 3: Restore to local
  log('3️⃣  Restoring auth users to local database...', 'cyan')

  // Find psql
  let psqlPath = 'psql'
  const possiblePaths = [
    '/opt/homebrew/opt/libpq/bin/psql',
    '/usr/local/bin/psql',
    '/usr/bin/psql',
    'psql',
  ]

  for (const path of possiblePaths) {
    try {
      execSync(`which ${path}`, { stdio: 'ignore' })
      psqlPath = path
      break
    } catch {
      // Try next path
    }
  }

  try {
    // Restore users/identities. Prefer no trigger fiddling — local postgres
    // is often not owner of auth.* (supabase_auth_admin owns them).
    execSync(
      `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "${filteredFile}"`,
      { stdio: 'inherit' },
    )
  } catch (error) {
    log('❌ Failed to restore auth users to local database.', 'red')
    log(`   Error: ${error instanceof Error ? error.message : String(error)}`, 'red')
    if (existsSync(tempFile)) unlinkSync(tempFile)
    if (existsSync(filteredFile)) unlinkSync(filteredFile)
    process.exit(1)
  }

  // Cleanup
  if (existsSync(tempFile)) unlinkSync(tempFile)
  if (existsSync(filteredFile)) unlinkSync(filteredFile)

  const userInsertLines = filteredLines.filter((l) =>
    normalizeInsertTarget(l).startsWith('INSERT INTO AUTH.USERS'),
  ).length

  log(`✅ Copied auth users successfully (${userInsertLines} INSERT block(s))!`, 'green')
  console.log('')
  log('💡 Note:', 'blue')
  log('   - Users can now log in locally with their remote passwords', 'cyan')
  log(
    '   - Email confirmation is disabled in local dev, so emails work immediately',
    'cyan',
  )
  log(
    "   - Sessions/refresh tokens were not copied (you'll need to log in again)",
    'cyan',
  )
}

copyAuth().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})
