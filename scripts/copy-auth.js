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
    // Dump auth schema (users, identities, but skip sessions/refresh_tokens)
    execSync(
      `npx supabase db dump --linked --schema auth --data-only > "${tempFile}" 2>&1`,
      { stdio: 'pipe' },
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

  // Filter to only include INSERT statements for users and identities
  const lines = dumpContent.split('\n')
  const filteredLines = []
  let inUsersInsert = false
  let inIdentitiesInsert = false
  let currentInsert = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('--')) {
      continue
    }

    // Detect INSERT INTO auth.users
    if (trimmed.toUpperCase().startsWith('INSERT INTO AUTH.USERS')) {
      inUsersInsert = true
      inIdentitiesInsert = false
      currentInsert = [line]
      continue
    }

    // Detect INSERT INTO auth.identities
    if (trimmed.toUpperCase().startsWith('INSERT INTO AUTH.IDENTITIES')) {
      inIdentitiesInsert = true
      inUsersInsert = false
      currentInsert = [line]
      continue
    }

    // Skip other INSERT statements (sessions, refresh_tokens, audit_log_entries, etc.)
    if (trimmed.toUpperCase().startsWith('INSERT INTO')) {
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
      // End of INSERT statement
      if (trimmed.endsWith(');')) {
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

  // Write filtered content to temp file
  const filteredFile = join(
    tmpdir(),
    `supabase_auth_filtered_${Date.now()}.sql`,
  )
  writeFileSync(filteredFile, filteredLines.join('\n'), 'utf-8')

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
    // First, temporarily disable triggers on auth.users and auth.identities
    // because Supabase has triggers that might interfere with bulk inserts
    const disableTriggersSQL = `
ALTER TABLE auth.users DISABLE TRIGGER ALL;
ALTER TABLE auth.identities DISABLE TRIGGER ALL;
`

    execSync(
      `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "${disableTriggersSQL.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' },
    )

    // Now restore the data
    execSync(
      `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "${filteredFile}"`,
      { stdio: 'inherit' },
    )

    // Re-enable triggers
    const enableTriggersSQL = `
ALTER TABLE auth.users ENABLE TRIGGER ALL;
ALTER TABLE auth.identities ENABLE TRIGGER ALL;
`

    execSync(
      `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "${enableTriggersSQL.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' },
    )
  } catch (error) {
    log('❌ Failed to restore auth users to local database.', 'red')
    log('   Error:', error.message, 'red')
    if (existsSync(tempFile)) unlinkSync(tempFile)
    if (existsSync(filteredFile)) unlinkSync(filteredFile)
    process.exit(1)
  }

  // Cleanup
  if (existsSync(tempFile)) unlinkSync(tempFile)
  if (existsSync(filteredFile)) unlinkSync(filteredFile)

  // Count how many users were copied
  const userCount = filteredLines.filter((l) =>
    l.toUpperCase().includes('INSERT INTO AUTH.USERS'),
  ).length

  log(`✅ Copied ${userCount} user(s) successfully!`, 'green')
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
