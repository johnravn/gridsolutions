#!/usr/bin/env node
/**
 * Copy data from remote Supabase database to local database
 * Usage: node scripts/copy-remote-data.js
 */

import { execFileSync, execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  buildOfferBasisBackfillSql,
  buildOfferBasisSchemaFinalizeSql,
  buildOfferBasisSchemaPrepSql,
  remoteDumpUsesLegacyOfferSchema,
} from './offer-basis-remote-copy.mjs'
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

function runPsql(psqlPath, sql) {
  execFileSync(
    psqlPath,
    [
      '-h',
      '127.0.0.1',
      '-p',
      '54322',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: 'postgres' },
    },
  )
}

/** After remote → local copy: do not retry historical notification emails (cron + triggers). */
const SUPPRESS_COPIED_NOTIFICATION_EMAILS_SQL = `
UPDATE public.notifications
SET email_sent_at = COALESCE(email_sent_at, now())
WHERE email_sent_at IS NULL;
`

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

  // Step 1b: Transform remote dump when local schema is ahead of production
  log('1️⃣b Transforming dump for local schema...', 'cyan')
  const rawDump = readFileSync(tempFile, 'utf8')
  const {
    sql: transformedDump,
    transformed,
    subrentalItems,
    droppedThemeScaling,
    companiesOnConflict,
  } = transformRemoteDataDump(rawDump)
  writeFileSync(tempFile, transformedDump, 'utf8')
  if (transformed) {
    const parts = []
    if (subrentalItems > 0 || rawDump.includes('internally_owned')) {
      parts.push(
        `mapped internally_owned → item_kind (${subrentalItems} subrental item(s) for reservation backfill)`,
      )
    }
    if (droppedThemeScaling) {
      parts.push('dropped companies.theme_scaling')
    }
    if (companiesOnConflict) {
      parts.push('companies INSERT uses ON CONFLICT (id) DO NOTHING')
    }
    log(`   ✅ ${parts.join('; ') || 'Applied schema transforms'}`, 'green')
  } else {
    log('   ℹ️  No schema transforms needed', 'cyan')
  }

  const needsOfferBasisBackfill = remoteDumpUsesLegacyOfferSchema(rawDump)
  if (needsOfferBasisBackfill) {
    log(
      '   ℹ️  Remote dump uses legacy offer_id columns — will backfill offer_bases after import',
      'cyan',
    )
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

  const offerPrepFile = join(tmpdir(), `offer_basis_prep_${Date.now()}.sql`)
  const offerBackfillFile = join(
    tmpdir(),
    `offer_basis_backfill_${Date.now()}.sql`,
  )
  const offerFinalizeFile = join(
    tmpdir(),
    `offer_basis_finalize_${Date.now()}.sql`,
  )
  if (needsOfferBasisBackfill) {
    writeFileSync(offerPrepFile, buildOfferBasisSchemaPrepSql(), 'utf8')
    writeFileSync(offerBackfillFile, buildOfferBasisBackfillSql(), 'utf8')
    writeFileSync(offerFinalizeFile, buildOfferBasisSchemaFinalizeSql(), 'utf8')
  }

  try {
    if (needsOfferBasisBackfill) {
      log('2️⃣a Preparing local schema for legacy offer import...', 'cyan')
      execSync(
        `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "${offerPrepFile}"`,
        { stdio: 'inherit' },
      )
    }

    execSync(
      `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "${tempFile}"`,
      { stdio: 'inherit' },
    )

    if (needsOfferBasisBackfill) {
      log('2️⃣b Backfilling offer_bases from imported offers...', 'cyan')
      execSync(
        `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "${offerBackfillFile}"`,
        { stdio: 'inherit' },
      )
      log('2️⃣d Restoring offer_basis constraints...', 'cyan')
      execSync(
        `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "${offerFinalizeFile}"`,
        { stdio: 'inherit' },
      )
      log('   ✅ Offer bases backfilled from legacy remote offers', 'green')
    }

    log(
      '2️⃣c Suppressing pending notification emails from copied data...',
      'cyan',
    )
    try {
      runPsql(psqlPath, SUPPRESS_COPIED_NOTIFICATION_EMAILS_SQL)
      log(
        '   ✅ Marked copied notifications as email-processed (avoids cron retries to seed/test inboxes)',
        'green',
      )
    } catch {
      log('   ⚠️  Could not suppress copied notification emails', 'yellow')
    }

    if (backfillSql) {
      log('2️⃣e Backfilling reservation subcontractor links...', 'cyan')
      execSync(
        `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "${backfillFile}"`,
        { stdio: 'inherit' },
      )
    }
  } catch (error) {
    log('❌ Failed to restore data to local database.', 'red')
    if (existsSync(tempFile)) unlinkSync(tempFile)
    if (existsSync(backfillFile)) unlinkSync(backfillFile)
    if (existsSync(offerPrepFile)) unlinkSync(offerPrepFile)
    if (existsSync(offerBackfillFile)) unlinkSync(offerBackfillFile)
    if (existsSync(offerFinalizeFile)) unlinkSync(offerFinalizeFile)
    process.exit(1)
  }

  // Cleanup
  if (existsSync(tempFile)) unlinkSync(tempFile)
  if (existsSync(backfillFile)) unlinkSync(backfillFile)
  if (existsSync(offerPrepFile)) unlinkSync(offerPrepFile)
  if (existsSync(offerBackfillFile)) unlinkSync(offerBackfillFile)
  if (existsSync(offerFinalizeFile)) unlinkSync(offerFinalizeFile)

  log('✅ Data copied successfully!', 'green')
  console.log('')
  log('💡 Tip: Run this script anytime to refresh local data:', 'blue')
  log('   npm run db:copy-data', 'cyan')
}

copyData().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red')
  process.exit(1)
})
