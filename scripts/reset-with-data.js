#!/usr/bin/env node
/**
 * Reset local database and populate with data from remote
 * This is a convenience script that combines db:reset + vault seed + db:copy-data (+ storage).
 * Usage: node scripts/reset-with-data.js  —  or: npm run db:reset:with-data
 *
 * `npm run db:reset` runs scripts/db-reset.mjs (SUPABASE_DB_ONLY + recovery if CLI dies with 502
 * after migrations; see supabase/cli#4535).
 */

import { execSync } from 'child_process'

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runWithRetry(command, { retries = 2, delayMs = 15000 } = {}) {
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      execSync(command, { stdio: 'inherit' })
      return
    } catch (error) {
      if (attempt > retries) {
        throw error
      }

      log(
        '   ⚠️  Command failed (often transient during container restart)',
        'yellow',
      )
      log(`   Retrying in ${Math.round(delayMs / 1000)}s...`, 'cyan')
      await sleep(delayMs)
    }
  }
}

async function resetWithData() {
  log('🔄 Resetting local database and populating with remote data...', 'blue')
  console.log('')

  try {
    // Step 1: Reset database (applies migrations + seed file)
    log('1️⃣  Resetting local database...', 'cyan')
    log('   (Migrations, seed.sql, bucket sync, and db:seed-email-vault-local)', 'cyan')
    // db:reset often fails with 502 while Docker restarts Kong/DB — retry with longer backoff.
    await runWithRetry('npm run db:reset', { retries: 4, delayMs: 20000 })
    log('   ✅ Database reset complete', 'green')
    console.log('')

    // Step 2: Vault secrets for pg_net → Edge Functions (DB-triggered notification emails)
    // db:reset already runs this when it succeeds; run again here so it is explicit for this
    // workflow and retries after containers settle if the first attempt was skipped.
    log('2️⃣  Seeding local Vault for notification email dispatch (pg_net)...', 'cyan')
    try {
      execSync('npm run db:seed-email-vault-local', { stdio: 'inherit' })
      log('   ✅ Vault secrets project_url + anon_key updated', 'green')
    } catch {
      log(
        '   ⚠️  Vault seed failed or skipped (Supabase must be running)',
        'yellow',
      )
      log('   Run later: npm run db:seed-email-vault-local', 'cyan')
    }
    console.log('')

    // Step 3: Copy auth users from remote
    log('3️⃣  Copying authentication users from remote...', 'cyan')
    try {
      execSync('npm run db:copy-auth', { stdio: 'inherit' })
      log('   ✅ Auth users copied', 'green')
    } catch (error) {
      log('   ⚠️  Auth copy had issues (continuing anyway)', 'yellow')
      log('   You can run: npm run db:copy-auth later', 'cyan')
    }
    console.log('')

    // Step 4: Copy data from remote
    log('4️⃣  Copying data from remote database...', 'cyan')
    execSync('npm run db:copy-data', { stdio: 'inherit' })
    log('   ✅ Data copy complete', 'green')
    console.log('')

    // Step 5: Sync storage buckets (already done in db:reset, but just in case)
    log('5️⃣  Verifying storage buckets...', 'cyan')
    execSync('npm run db:sync-buckets', { stdio: 'inherit' })
    log('   ✅ Buckets synced', 'green')
    console.log('')

    // Step 6: Copy storage files (actual files in buckets)
    log('6️⃣  Copying storage files from remote...', 'cyan')
    log('   (This may take a while if you have many files)', 'yellow')
    try {
      execSync('npm run db:copy-storage', { stdio: 'inherit' })
      log('   ✅ Storage files copied', 'green')
    } catch (error) {
      log('   ⚠️  Storage copy had issues (this is optional)', 'yellow')
      log('   You can run: npm run db:copy-storage later', 'cyan')
    }
    console.log('')

    log('✅ Local database is now reset and fully populated!', 'green')
    console.log('')
    log('💡 What was included:', 'blue')
    log('   ✅ Database schema (migrations)', 'green')
    log('   ✅ Vault secrets for pg_net → Edge Functions (trigger emails)', 'green')
    log('   ✅ Authentication users (can log in locally)', 'green')
    log('   ✅ Database data (all tables)', 'green')
    log('   ✅ Storage bucket definitions', 'green')
    log('   ✅ Storage files (images, PDFs, etc.)', 'green')
    console.log('')
    log('💡 Next steps:', 'blue')
    log('   - Your local DB now has all data from remote', 'cyan')
    log('   - You can start developing: npm run dev', 'cyan')
    log('   - To refresh data later: npm run db:copy-data', 'cyan')
    log('   - To refresh files: npm run db:copy-storage', 'cyan')
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    process.exit(1)
  }
}

resetWithData().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red')
  process.exit(1)
})
