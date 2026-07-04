#!/usr/bin/env node
/**
 * Copy data from remote Supabase database to local database
 * Usage: node scripts/copy-remote-data.js
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  buildSubrentalBackfillSql,
  transformRemoteDataDump,
} from './transform-remote-data-dump.mjs'

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

async function copyData() {
  log('📥 Copying data from remote to local database...', 'blue')
  console.log('')

  // Check if local Supabase is running
  if (!checkLocalRunning()) {
    log('❌ Local Supabase is not running.', 'red')
    log('   Start it with: npm run supabase:start', 'yellow')
    process.exit(1)
  }

  // Step 1: Dump data from remote
  log('1️⃣  Dumping data from remote database...', 'cyan')
  const tempFile = join(tmpdir(), `supabase_data_${Date.now()}.sql`)

  try {
    execSync(`npx supabase db dump --data-only --linked > "${tempFile}"`, {
      stdio: 'inherit',
    })
  } catch (error) {
    log('❌ Failed to dump remote data.', 'red')
    log("   Make sure you're linked: npm run supabase:link", 'yellow')
    if (existsSync(tempFile)) unlinkSync(tempFile)
    process.exit(1)
  }

  // Check if dump has content
  const fs = await import('fs')
  const stats = fs.statSync(tempFile)
  if (stats.size === 0) {
    log('⚠️  Remote database appears to be empty or dump failed.', 'yellow')
    if (existsSync(tempFile)) unlinkSync(tempFile)
    return
  }

  // Step 1b: Transform remote dump when local schema is ahead (item_kind vs ownership)
  log('1️⃣b Transforming dump for local schema...', 'cyan')
  const rawDump = readFileSync(tempFile, 'utf8')
  const {
    sql: transformedDump,
    transformed,
    subrentalItems,
  } = transformRemoteDataDump(rawDump)
  writeFileSync(tempFile, transformedDump, 'utf8')
  if (transformed) {
    log(
      `   ✅ Mapped internally_owned → item_kind (stock/subrental); ${subrentalItems} subrental item(s) tracked for reservation backfill`,
      'green',
    )
  } else {
    log('   ℹ️  No ownership → item_kind transform needed', 'cyan')
  }
  console.log('')

  // Step 2: Restore to local
  log('2️⃣  Restoring data to local database...', 'cyan')

  // Find psql - try common locations
  let psqlPath = 'psql'
  const possiblePaths = [
    '/opt/homebrew/opt/libpq/bin/psql',
    '/usr/local/bin/psql',
    '/usr/bin/psql',
    'psql', // fallback to PATH
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

  const backfillFile = join(tmpdir(), `subrental_backfill_${Date.now()}.sql`)
  const backfillSql = buildSubrentalBackfillSql()
  if (backfillSql) {
    writeFileSync(backfillFile, backfillSql, 'utf8')
  }

  try {
    execSync(
      `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "${tempFile}"`,
      { stdio: 'inherit' },
    )

    if (backfillSql) {
      log('2️⃣b Backfilling reservation subcontractor links...', 'cyan')
      execSync(
        `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "${backfillFile}"`,
        { stdio: 'inherit' },
      )
    }
  } catch (error) {
    log('❌ Failed to restore data to local database.', 'red')
    if (existsSync(tempFile)) unlinkSync(tempFile)
    if (existsSync(backfillFile)) unlinkSync(backfillFile)
    process.exit(1)
  }

  // Cleanup
  if (existsSync(tempFile)) unlinkSync(tempFile)
  if (existsSync(backfillFile)) unlinkSync(backfillFile)

  log('✅ Data copied successfully!', 'green')
  console.log('')
  log('💡 Tip: Run this script anytime to refresh local data:', 'blue')
  log('   npm run db:copy-data', 'cyan')
}

copyData().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red')
  process.exit(1)
})
