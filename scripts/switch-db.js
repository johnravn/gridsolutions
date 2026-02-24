#!/usr/bin/env node
/**
 * Switch between local and remote Supabase databases
 * Usage: node scripts/switch-db.js {local|remote|status}
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const ENV_FILE = join(ROOT, '.env.local')
const LOCAL_ENV = join(ROOT, '.env.local.db')
const REMOTE_ENV = join(ROOT, '.env.remote.db')

const SUPABASE_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_SERVICE_ROLE_KEY',
]

function lineIsSupabaseKey(line) {
  const trimmed = line.trim()
  return SUPABASE_KEYS.some((key) => trimmed.startsWith(key + '='))
}

function getSupabaseLines(configContent) {
  return configContent
    .split(/\r?\n/)
    .filter((line) => lineIsSupabaseKey(line))
    .map((line) => line.trim())
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function showCurrent() {
  if (!existsSync(ENV_FILE)) {
    log('No .env.local file found', 'yellow')
    return
  }

  const content = readFileSync(ENV_FILE, 'utf-8')
  if (content.includes('127.0.0.1:54321')) {
    log('Current: LOCAL database', 'green')
    log('  URL: http://127.0.0.1:54321', 'cyan')
  } else if (content.includes('supabase.co')) {
    log('Current: REMOTE database', 'green')
    const urlMatch = content.match(/VITE_SUPABASE_URL=(.+)/)
    if (urlMatch) {
      log(`  URL: ${urlMatch[1]}`, 'cyan')
    }
  } else {
    log('Current: Unknown configuration', 'yellow')
  }
  log('', 'reset')
  log('Note: The app badge (bottom left) uses env from when the dev server started.', 'yellow')
  log('If the badge and status disagree, restart the dev server: npm run dev', 'yellow')
}

function switchToLocal() {
  if (!existsSync(LOCAL_ENV)) {
    log(`Creating ${LOCAL_ENV}...`, 'yellow')
    const template = `# Local Supabase Configuration
# Get these values from: npm run db:status

VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn

# Keep your other environment variables below
`
    writeFileSync(LOCAL_ENV, template)
    log(
      `Please update ${LOCAL_ENV} with your local anon key from 'npm run db:status'`,
      'yellow',
    )
  }

  // Read existing .env.local to preserve other variables
  let existingEnv = ''
  if (existsSync(ENV_FILE)) {
    existingEnv = readFileSync(ENV_FILE, 'utf-8')
  }

  // Read local config
  const localConfig = readFileSync(LOCAL_ENV, 'utf-8')

  // Merge: use local config for Supabase vars, keep other vars from existing
  const lines = existingEnv.split(/\r?\n/)
  const otherVars = lines.filter(
    (line) => !lineIsSupabaseKey(line) && line.trim() !== '',
  )
  const supabaseVars = getSupabaseLines(localConfig)
  if (supabaseVars.length === 0) {
    log(`No Supabase vars found in ${LOCAL_ENV}`, 'yellow')
    return
  }
  const merged = [...supabaseVars, '', ...otherVars].join('\n')
  writeFileSync(ENV_FILE, merged)

  log('✓ Switched to LOCAL database', 'green')
  log('Make sure Supabase is running: npm run supabase:start', 'blue')
  log('Restart your dev server (npm run dev) if it is running.', 'blue')
}

function switchToRemote() {
  if (!existsSync(REMOTE_ENV)) {
    log(`Creating ${REMOTE_ENV}...`, 'yellow')
    const template = `# Remote Supabase Configuration
# Get these from: https://app.supabase.com/project/tlpgejkglrgoljgvpubn/settings/api

VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_REMOTE_ANON_KEY_HERE
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
# Optional: for calendar feed and other server-side use
# SUPABASE_SERVICE_ROLE_KEY=your_remote_service_role_key

# Keep your other environment variables below
`
    writeFileSync(REMOTE_ENV, template)
    log(`Please update ${REMOTE_ENV} with your remote anon key`, 'yellow')
  }

  // Read existing .env.local to preserve other variables
  let existingEnv = ''
  if (existsSync(ENV_FILE)) {
    existingEnv = readFileSync(ENV_FILE, 'utf-8')
  }

  // Read remote config
  const remoteConfig = readFileSync(REMOTE_ENV, 'utf-8')

  // Merge: use remote config for Supabase vars, keep other vars from existing
  const lines = existingEnv.split(/\r?\n/)
  const otherVars = lines.filter(
    (line) => !lineIsSupabaseKey(line) && line.trim() !== '',
  )
  const supabaseVars = getSupabaseLines(remoteConfig)
  if (supabaseVars.length === 0) {
    log(`No Supabase vars found in ${REMOTE_ENV}. Add at least VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`, 'yellow')
    return
  }
  const hasUrl = supabaseVars.some((line) => line.startsWith('VITE_SUPABASE_URL='))
  if (!hasUrl) {
    log('Warning: VITE_SUPABASE_URL not found in remote config.', 'yellow')
  }
  const merged = [...supabaseVars, '', ...otherVars].join('\n')
  writeFileSync(ENV_FILE, merged)

  log('✓ Switched to REMOTE database', 'green')
  log('Restart your dev server (npm run dev) if it is running.', 'blue')
}

// Main
const command = process.argv[2]

switch (command) {
  case 'local':
    switchToLocal()
    break
  case 'remote':
    switchToRemote()
    break
  case 'status':
    showCurrent()
    break
  default:
    console.log('Usage: npm run db:switch:{local|remote|status}')
    console.log('')
    console.log('Commands:')
    console.log('  db:switch:local   - Switch to local Supabase database')
    console.log('  db:switch:remote  - Switch to remote Supabase database')
    console.log('  db:switch:status  - Show current database configuration')
    console.log('')
    showCurrent()
    process.exit(1)
}
