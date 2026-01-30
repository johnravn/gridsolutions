#!/usr/bin/env node
/**
 * Copy storage files from remote Supabase to local
 * Usage: node scripts/copy-storage.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

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

async function copyStorage() {
  log('📦 Copying storage files from remote to local...', 'blue')
  console.log('')

  // Get remote credentials from .env.remote.db if it exists
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
  // Use service role key for local to bypass RLS for file uploads
  const localServiceKey =
    process.env.SUPABASE_LOCAL_SERVICE_KEY ||
    'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz' // Default local service key

  // Create clients - use service role for local to bypass RLS
  const remoteClient = createClient(remoteUrl, remoteKey)
  const localClient = createClient(localUrl, localServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  // Known bucket names as fallback if API listing fails
  const knownBuckets = [
    'company_files',
    'vehicle_images',
    'job_files',
    'avatars',
    'logos',
    'matter_files',
  ]

  try {
    // Try to list buckets from remote (using anon key - may fail due to RLS)
    log('1️⃣  Listing buckets from remote...', 'cyan')
    log(`   Connecting to: ${remoteUrl}`, 'cyan')

    let buckets = []
    const { data: listedBuckets, error: bucketsError } =
      await remoteClient.storage.listBuckets()

    if (bucketsError || !listedBuckets || listedBuckets.length === 0) {
      log(
        `   ⚠️  Cannot list buckets from remote (anon key may not have permission)`,
        'yellow',
      )
      log(`   Will try known bucket names as fallback...`, 'cyan')
      buckets = knownBuckets.map((name) => ({ name, public: true }))
    } else {
      buckets = listedBuckets
      log(`   Found ${buckets.length} bucket(s) via API`, 'green')
    }

    // Also list local buckets to verify they exist (using service role key)
    log(`\n   Checking local buckets...`, 'cyan')
    const { data: localBuckets, error: localBucketsError } =
      await localClient.storage.listBuckets()

    if (!localBucketsError && localBuckets && localBuckets.length > 0) {
      const localBucketNames = localBuckets.map((b) => b.name)
      log(
        `   Found ${localBuckets.length} local bucket(s): ${localBucketNames.join(', ')}`,
        'green',
      )

      // Filter out buckets that don't exist locally
      buckets = buckets.filter((b) => localBucketNames.includes(b.name))
      if (buckets.length !== listedBuckets?.length) {
        log(
          `   Filtered to ${buckets.length} bucket(s) that exist in both remote and local`,
          'cyan',
        )
      }
    }

    if (buckets.length === 0) {
      log('❌ No buckets to process', 'red')
      return
    }

    // Process each bucket
    for (const bucket of buckets) {
      log(`\n2️⃣  Processing bucket: ${bucket.name}`, 'cyan')

      // List files in bucket (recursive to handle folders)
      async function listFilesRecursive(path = '') {
        const { data: files, error: listError } = await remoteClient.storage
          .from(bucket.name)
          .list(path, {
            limit: 1000,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          })

        if (listError) {
          // If bucket doesn't exist or we can't access it, skip
          if (
            listError.message.includes('not found') ||
            listError.message.includes('Bucket')
          ) {
            return []
          }
          throw listError
        }

        if (!files || files.length === 0) {
          return []
        }

        // Handle folders recursively
        const allFiles = []
        for (const file of files) {
          if (file.id === null && file.name) {
            // It's a folder, recurse
            const folderPath = path ? `${path}/${file.name}` : file.name
            const folderFiles = await listFilesRecursive(folderPath)
            allFiles.push(...folderFiles)
          } else if (file.name) {
            // It's a file
            allFiles.push({
              ...file,
              fullPath: path ? `${path}/${file.name}` : file.name,
            })
          }
        }
        return allFiles
      }

      let files
      try {
        files = await listFilesRecursive()
      } catch (listError) {
        log(
          `   ⚠️  Cannot access bucket ${bucket.name}: ${listError.message}`,
          'yellow',
        )
        continue
      }

      if (!files || files.length === 0) {
        log(
          `   No files in bucket ${bucket.name} (or bucket doesn't exist)`,
          'yellow',
        )
        continue
      }

      log(`   Found ${files.length} file(s)`, 'green')

      // Try to list files - if this works, bucket exists
      // We'll check existence by trying to list files

      // Copy each file
      let copied = 0
      let skipped = 0

      for (const file of files) {
        if (file.id === null) {
          // It's a folder, skip for now (could recurse if needed)
          continue
        }

        const filePath = file.fullPath || file.name

        try {
          // Download from remote
          const { data: fileData, error: downloadError } =
            await remoteClient.storage.from(bucket.name).download(filePath)

          if (downloadError) {
            log(
              `   ⚠️  Failed to download ${filePath}: ${downloadError.message}`,
              'yellow',
            )
            skipped++
            continue
          }

          // Convert blob to array buffer
          const arrayBuffer = await fileData.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // Upload to local
          const { error: uploadError } = await localClient.storage
            .from(bucket.name)
            .upload(filePath, buffer, {
              contentType: file.metadata?.mimetype,
              upsert: true, // Overwrite if exists
            })

          if (uploadError) {
            log(
              `   ⚠️  Failed to upload ${filePath}: ${uploadError.message}`,
              'yellow',
            )
            skipped++
          } else {
            copied++
            process.stdout.write(`   ✓ ${filePath}\r`)
          }
        } catch (error) {
          log(`   ⚠️  Error copying ${filePath}: ${error.message}`, 'yellow')
          skipped++
        }
      }

      console.log('') // New line after progress
      log(`   ✅ Copied ${copied} file(s), skipped ${skipped}`, 'green')
    }

    log('\n✅ Storage copy completed!', 'green')
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    process.exit(1)
  }
}

// Check if local Supabase is running
import { execSync } from 'child_process'
function checkLocalRunning() {
  try {
    execSync('docker ps | grep supabase_db_grid', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (!checkLocalRunning()) {
  log('❌ Local Supabase is not running.', 'red')
  log('   Start it with: npm run supabase:start', 'yellow')
  process.exit(1)
}

copyStorage().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red')
  process.exit(1)
})
