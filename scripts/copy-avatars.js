#!/usr/bin/env node
/**
 * Copy avatar files from remote Supabase to local
 * Queries storage.objects table directly to find avatar files
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

async function copyAvatars() {
  log('👤 Copying avatar files from remote to local...', 'blue')
  console.log('')

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

  if (!remoteKey) {
    log('❌ Need remote anon key in .env.remote.db', 'red')
    process.exit(1)
  }

  // Get local credentials
  const localUrl = 'http://127.0.0.1:54321'
  const localServiceKey =
    process.env.SUPABASE_LOCAL_SERVICE_KEY ||
    'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'

  // Create clients
  const remoteClient = createClient(remoteUrl, remoteKey)
  const localClient = createClient(localUrl, localServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // Method 1: Query profiles table for avatar_url paths
    log('1️⃣  Finding avatar paths from profiles table...', 'cyan')
    let avatarPaths = []

    try {
      const { data: profiles, error: queryError } = await remoteClient
        .from('profiles')
        .select('avatar_url')
        .not('avatar_url', 'is', null)

      if (!queryError && profiles && profiles.length > 0) {
        avatarPaths = [
          ...new Set(profiles.map((p) => p.avatar_url).filter(Boolean)),
        ]
        log(
          `   Found ${avatarPaths.length} avatar path(s) from profiles`,
          'green',
        )
      }
    } catch (error) {
      log(
        `   ⚠️  Cannot query profiles (RLS may block): ${error.message}`,
        'yellow',
      )
    }

    // Method 2: Try to list files in avatars bucket directly (may work if bucket is public)
    if (avatarPaths.length === 0) {
      log('   Trying to list files in avatars bucket directly...', 'cyan')
      try {
        const { data: files, error: listError } = await remoteClient.storage
          .from('avatars')
          .list('', { limit: 1000 })

        if (!listError && files && files.length > 0) {
          // Recursively get all files
          async function getAllFiles(path = '') {
            const { data: items } = await remoteClient.storage
              .from('avatars')
              .list(path, { limit: 1000 })

            if (!items) return []

            const allFiles = []
            for (const item of items) {
              if (item.id === null && item.name) {
                // Folder
                const folderPath = path ? `${path}/${item.name}` : item.name
                const folderFiles = await getAllFiles(folderPath)
                allFiles.push(...folderFiles)
              } else if (item.name) {
                // File
                allFiles.push(path ? `${path}/${item.name}` : item.name)
              }
            }
            return allFiles
          }

          const allFiles = await getAllFiles()
          avatarPaths = allFiles
          log(
            `   Found ${avatarPaths.length} file(s) in avatars bucket`,
            'green',
          )
        }
      } catch (error) {
        log(`   ⚠️  Cannot list files: ${error.message}`, 'yellow')
      }
    }

    if (avatarPaths.length === 0) {
      log('⚠️  No avatars found', 'yellow')
      log('', 'reset')
      log('The avatars bucket uses RLS, so we need either:', 'yellow')
      log('1. Service role key to query profiles table', 'cyan')
      log(
        '   Get it from: https://app.supabase.com/project/tlpgejkglrgoljgvpubn/settings/api',
        'cyan',
      )
      log('   Look for "service_role" key (longer than anon key)', 'cyan')
      log(
        '   Add to .env.remote.db: SUPABASE_SERVICE_ROLE_KEY=your_key_here',
        'cyan',
      )
      log('', 'reset')
      log('2. Or manually copy avatar files via Supabase Studio:', 'yellow')
      log(
        '   https://app.supabase.com/project/tlpgejkglrgoljgvpubn/storage/buckets/avatars',
        'cyan',
      )
      return
    }

    // Copy each avatar
    log(`\n2️⃣  Copying ${avatarPaths.length} avatar(s)...`, 'cyan')
    let copied = 0
    let skipped = 0

    for (const avatarPath of avatarPaths) {
      try {
        // Download from remote
        const { data: fileData, error: downloadError } =
          await remoteClient.storage.from('avatars').download(avatarPath)

        if (downloadError) {
          log(
            `   ⚠️  Cannot download ${avatarPath}: ${downloadError.message}`,
            'yellow',
          )
          skipped++
          continue
        }

        // Convert blob to buffer
        const arrayBuffer = await fileData.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to local
        const { error: uploadError } = await localClient.storage
          .from('avatars')
          .upload(avatarPath, buffer, { upsert: true })

        if (uploadError) {
          log(
            `   ⚠️  Cannot upload ${avatarPath}: ${uploadError.message}`,
            'yellow',
          )
          skipped++
          continue
        }

        copied++
        log(`   ✓ ${avatarPath}`, 'green')
      } catch (error) {
        log(`   ⚠️  Error copying ${avatarPath}: ${error.message}`, 'yellow')
        skipped++
      }
    }

    log(`\n✅ Copied ${copied} avatar(s), skipped ${skipped}`, 'green')
  } catch (error) {
    log(`❌ Unexpected error: ${error.message}`, 'red')
    process.exit(1)
  }
}

copyAvatars()
