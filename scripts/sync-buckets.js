#!/usr/bin/env node
/**
 * Sync storage bucket definitions from remote Supabase to local
 * This ensures all buckets (including manually created ones) exist locally
 * Usage: node scripts/sync-buckets.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
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

function getEnvVar(name) {
  // Try to read from .env.local
  let envContent = ''
  if (existsSync('.env.local')) {
    envContent = readFileSync('.env.local', 'utf-8')
  }

  // Extract value
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (match) {
    return match[1].trim()
  }
  return process.env[name]
}

function checkLocalRunning() {
  try {
    execSync('docker ps | grep supabase_db_grid', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function syncBuckets() {
  log('🪣 Syncing storage bucket definitions from remote to local...', 'blue')
  console.log('')

  // Check if local Supabase is running
  if (!checkLocalRunning()) {
    log('❌ Local Supabase is not running.', 'red')
    log('   Start it with: npm run supabase:start', 'yellow')
    process.exit(1)
  }

  // Get remote credentials
  let remoteUrl = 'https://tlpgejkglrgoljgvpubn.supabase.co'
  let remoteKey = ''

  if (existsSync('.env.remote.db')) {
    const remoteEnv = readFileSync('.env.remote.db', 'utf-8')
    const urlMatch = remoteEnv.match(/VITE_SUPABASE_URL=(.+)/)
    const keyMatch = remoteEnv.match(/VITE_SUPABASE_ANON_KEY=(.+)/)
    if (urlMatch) remoteUrl = urlMatch[1].trim()
    if (keyMatch) remoteKey = keyMatch[1].trim()
  }

  // Fallback to current .env.local if it's pointing to remote
  if (!remoteKey || remoteKey === 'YOUR_REMOTE_ANON_KEY_HERE') {
    const currentEnv = existsSync('.env.local')
      ? readFileSync('.env.local', 'utf-8')
      : ''
    if (currentEnv.includes('supabase.co')) {
      const keyMatch = currentEnv.match(/VITE_SUPABASE_ANON_KEY=(.+)/)
      if (keyMatch) remoteKey = keyMatch[1].trim()
      const urlMatch = currentEnv.match(/VITE_SUPABASE_URL=(.+)/)
      if (urlMatch) remoteUrl = urlMatch[1].trim()
    }
  }

  if (
    !remoteKey ||
    remoteKey.includes('127.0.0.1') ||
    remoteKey === 'YOUR_REMOTE_ANON_KEY_HERE'
  ) {
    log('❌ Please configure remote credentials:', 'red')
    log('   1. Update .env.remote.db with your remote anon key', 'yellow')
    log('   2. Or switch to remote: npm run db:switch:remote', 'yellow')
    process.exit(1)
  }

  // Get local credentials
  const localUrl = 'http://127.0.0.1:54321'
  // Use service role key for local to bypass RLS
  const localServiceKey =
    process.env.SUPABASE_LOCAL_SERVICE_KEY ||
    'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz' // Default local service key

  // Create clients
  const remoteClient = createClient(remoteUrl, remoteKey)
  const localClient = createClient(localUrl, localServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  try {
    // Step 1: Get buckets from remote using storage API
    log('1️⃣  Fetching bucket definitions from remote...', 'cyan')

    let remoteBuckets = []

    // Try using storage API first (most reliable)
    try {
      log('   Querying remote storage API...', 'cyan')
      const { data: listedBuckets, error: listError } =
        await remoteClient.storage.listBuckets()

      if (listError) {
        throw new Error(listError.message)
      }

      if (!listedBuckets || listedBuckets.length === 0) {
        log(
          '   ⚠️  No buckets found via API, trying database dump...',
          'yellow',
        )
        throw new Error('No buckets found')
      }

      // Convert API response to bucket format
      remoteBuckets = listedBuckets.map((b) => ({
        id: b.name,
        name: b.name,
        public: b.public || false,
        file_size_limit: null, // API doesn't return these details
        allowed_mime_types: null,
      }))
      log('   ✓ Retrieved buckets via storage API', 'green')
    } catch (apiError) {
      log(`   ⚠️  Storage API failed: ${apiError.message}`, 'yellow')
      log('   Trying to extract from database dump...', 'cyan')

      // Fallback: Try to get buckets from database dump
      try {
        const { writeFileSync, readFileSync, unlinkSync } = await import('fs')
        const { join } = await import('path')
        const { tmpdir } = await import('os')

        const tempFile = join(tmpdir(), `supabase_buckets_${Date.now()}.sql`)

        // Dump only storage schema
        execSync(
          `npx supabase db dump --linked --schema storage > "${tempFile}" 2>/dev/null || true`,
          { stdio: 'pipe' },
        )

        const dumpContent = readFileSync(tempFile, 'utf-8')
        unlinkSync(tempFile)

        // Parse INSERT statements for buckets
        const bucketMatches = dumpContent.matchAll(
          /INSERT INTO storage\.buckets[^;]+;/gi,
        )
        for (const match of bucketMatches) {
          const insert = match[0]
          const idMatch = insert.match(
            /id\s*=\s*'([^']+)'|'([^']+)',\s*'([^']+)'/i,
          )
          const publicMatch = insert.match(/public\s*=\s*(true|false|t|f)/i)
          const sizeMatch = insert.match(/file_size_limit\s*=\s*(\d+)/i)
          const mimeMatch = insert.match(
            /allowed_mime_types\s*=\s*ARRAY\[([^\]]+)\]/i,
          )

          if (idMatch) {
            const bucketId = idMatch[1] || idMatch[2] || idMatch[3]
            remoteBuckets.push({
              id: bucketId,
              name: bucketId,
              public: publicMatch
                ? publicMatch[1].toLowerCase() === 'true' ||
                  publicMatch[1].toLowerCase() === 't'
                : false,
              file_size_limit: sizeMatch ? parseInt(sizeMatch[1]) : null,
              allowed_mime_types: mimeMatch
                ? mimeMatch[1]
                    .split(',')
                    .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
                : null,
            })
          }
        }

        if (remoteBuckets.length > 0) {
          log(
            `   ✓ Found ${remoteBuckets.length} bucket(s) in database dump`,
            'green',
          )
        } else {
          throw new Error('No buckets found in dump')
        }
      } catch (dumpError) {
        log(`   ⚠️  Database dump also failed: ${dumpError.message}`, 'yellow')
        log('   Using known bucket names as fallback...', 'cyan')
        // Fallback to known buckets from migrations and codebase
        remoteBuckets = [
          { id: 'company_files', name: 'company_files', public: true },
          { id: 'vehicle_images', name: 'vehicle_images', public: true },
          { id: 'job_files', name: 'job_files', public: true },
          { id: 'avatars', name: 'avatars', public: true },
          { id: 'logos', name: 'logos', public: true },
          { id: 'matter_files', name: 'matter_files', public: true },
        ]
      }
    }

    if (remoteBuckets.length === 0) {
      log('❌ No buckets found on remote', 'red')
      return
    }

    log(`   Found ${remoteBuckets.length} bucket(s) on remote`, 'green')
    remoteBuckets.forEach((b) => {
      log(`      - ${b.id} (public: ${b.public})`, 'cyan')
    })

    // Step 2: Get local buckets
    log('\n2️⃣  Checking local buckets...', 'cyan')
    const { data: localBuckets, error: localBucketsError } =
      await localClient.storage.listBuckets()

    if (localBucketsError) {
      log(
        `   ⚠️  Error listing local buckets: ${localBucketsError.message}`,
        'yellow',
      )
    }

    const localBucketNames = localBuckets ? localBuckets.map((b) => b.name) : []
    log(
      `   Found ${localBucketNames.length} bucket(s) locally: ${localBucketNames.join(', ') || 'none'}`,
      'green',
    )

    // Step 3: Create missing buckets locally using SQL
    log('\n3️⃣  Creating missing buckets locally...', 'cyan')

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

    let created = 0
    let skipped = 0

    for (const remoteBucket of remoteBuckets) {
      if (localBucketNames.includes(remoteBucket.id)) {
        log(`   ✓ ${remoteBucket.id} already exists`, 'green')
        skipped++
        continue
      }

      // Build SQL to create bucket
      const fileSizeLimit = remoteBucket.file_size_limit || 52428800 // Default 50MB
      const allowedMimeTypes =
        remoteBucket.allowed_mime_types &&
        remoteBucket.allowed_mime_types.length > 0
          ? `ARRAY[${remoteBucket.allowed_mime_types.map((t) => `'${t}'`).join(', ')}]`
          : 'NULL'

      const sql = `
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
          '${remoteBucket.id}',
          '${remoteBucket.name || remoteBucket.id}',
          ${remoteBucket.public},
          ${fileSizeLimit},
          ${allowedMimeTypes}
        )
        ON CONFLICT (id) DO NOTHING;
      `.trim()

      try {
        execSync(
          `PGPASSWORD=postgres ${psqlPath} -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "${sql.replace(/"/g, '\\"')}"`,
          { stdio: 'pipe' },
        )
        log(`   ✓ Created bucket: ${remoteBucket.id}`, 'green')
        created++
      } catch (error) {
        log(
          `   ⚠️  Failed to create bucket ${remoteBucket.id}: ${error.message}`,
          'yellow',
        )
        // Try using Supabase client as fallback
        try {
          const { error: createError } = await localClient.storage.createBucket(
            remoteBucket.id,
            {
              public: remoteBucket.public,
              fileSizeLimit: fileSizeLimit,
              allowedMimeTypes: remoteBucket.allowed_mime_types || undefined,
            },
          )
          if (createError) {
            log(`   ❌ Also failed via API: ${createError.message}`, 'red')
          } else {
            log(`   ✓ Created bucket via API: ${remoteBucket.id}`, 'green')
            created++
          }
        } catch (apiError) {
          log(`   ❌ Failed via API too: ${apiError.message}`, 'red')
        }
      }
    }

    console.log('')
    if (created > 0) {
      log(
        `✅ Created ${created} bucket(s), ${skipped} already existed`,
        'green',
      )
    } else {
      log(`✅ All buckets are in sync (${skipped} bucket(s))`, 'green')
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    console.error(error)
    process.exit(1)
  }
}

syncBuckets().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})
