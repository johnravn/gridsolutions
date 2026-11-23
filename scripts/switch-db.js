#!/usr/bin/env node
/**
 * Switch app env between local Docker, hosted Dev, and hosted Prod.
 * Usage: node scripts/switch-db.js {local|dev|prod|remote|status}
 *
 * `remote` is an alias for `prod` (legacy).
 * Profiles: .env.local.db | .env.dev.db | .env.remote.db (Prod)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  ROOT,
  ENV_FILES,
  PROD_PROJECT_REF,
  PROD_URL,
  lineIsSupabaseKey,
  parseEnvContent,
  supabaseLinesFromEnv,
  classifyEnvContent,
  resolveDevProjectRef,
} from './supabase-targets.mjs'

const ENV_FILE = join(ROOT, '.env.local')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

/** @param {string} message @param {keyof typeof colors} [color] */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function restartHint() {
  log(
    'Note: The app badge (bottom left) uses env from when the dev server started.',
    'yellow',
  )
  log(
    'If the badge and status disagree, restart the dev server: npm run dev',
    'yellow',
  )
}

function showCurrent() {
  if (!existsSync(ENV_FILE)) {
    log('No .env.local file found', 'yellow')
    return
  }

  const content = readFileSync(ENV_FILE, 'utf-8')
  const kind = classifyEnvContent(content)
  const env = parseEnvContent(content)
  const url = env.VITE_SUPABASE_URL ?? '(missing VITE_SUPABASE_URL)'
  const ref = env.SUPABASE_PROJECT_REF ?? '(missing SUPABASE_PROJECT_REF)'

  if (kind === 'local') {
    log('Current: LOCAL (Docker)', 'green')
  } else if (kind === 'dev') {
    log('Current: DEV (hosted)', 'green')
  } else if (kind === 'prod') {
    log('Current: PROD (hosted)', 'green')
  } else {
    log('Current: Unknown configuration', 'yellow')
  }
  log(`  URL: ${url}`, 'cyan')
  log(`  REF: ${ref}`, 'cyan')
  log('', 'reset')
  restartHint()
}

/**
 * @param {string} profilePath
 * @param {string} template
 */
function ensureProfile(profilePath, template) {
  if (existsSync(profilePath)) return
  log(`Creating ${profilePath}...`, 'yellow')
  writeFileSync(profilePath, template)
  log(`Fill in real keys in ${profilePath} (never commit that file).`, 'yellow')
}

/**
 * @param {'local' | 'dev' | 'prod'} target
 */
function switchTo(target) {
  if (target === 'local') {
    ensureProfile(
      ENV_FILES.local,
      `# Local Supabase (Docker)
# Get anon key from: npm run db:status

VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=REPLACE_WITH_LOCAL_ANON_KEY
SUPABASE_PROJECT_REF=local
# SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_LOCAL_SERVICE_ROLE_KEY
`,
    )
  } else if (target === 'dev') {
    ensureProfile(
      ENV_FILES.dev,
      `# Hosted Supabase Dev
# Dashboard → Project Settings → API (copy; do not invent keys)
# Never commit this file.

VITE_SUPABASE_URL=https://YOUR_DEV_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_DEV_ANON_KEY
SUPABASE_PROJECT_REF=YOUR_DEV_REF
# SUPABASE_SERVICE_ROLE_KEY=YOUR_DEV_SERVICE_ROLE_KEY
`,
    )
  } else {
    ensureProfile(
      ENV_FILES.prod,
      `# Hosted Supabase Prod
# https://supabase.com/dashboard/project/${PROD_PROJECT_REF}/settings/api
# Never commit this file. Prefer Dev for day-to-day work.

VITE_SUPABASE_URL=${PROD_URL}
VITE_SUPABASE_ANON_KEY=YOUR_PROD_ANON_KEY
SUPABASE_PROJECT_REF=${PROD_PROJECT_REF}
# SUPABASE_SERVICE_ROLE_KEY=YOUR_PROD_SERVICE_ROLE_KEY
`,
    )
  }

  const profilePath = ENV_FILES[target]
  const profileContent = readFileSync(profilePath, 'utf-8')
  const profileEnv = parseEnvContent(profileContent)
  const supabaseVars = supabaseLinesFromEnv(profileEnv)

  if (supabaseVars.length === 0) {
    log(`No Supabase vars found in ${profilePath}`, 'yellow')
    return
  }

  if (target === 'dev') {
    const ref = resolveDevProjectRef()
    if (!ref) {
      log(
        'Dev profile still has placeholders. After John creates the Dev project, paste URL/anon/ref (and optional service_role) into .env.dev.db',
        'yellow',
      )
    }
  }

  let existingEnv = ''
  if (existsSync(ENV_FILE)) {
    existingEnv = readFileSync(ENV_FILE, 'utf-8')
  }

  const otherVars = existingEnv
    .split(/\r?\n/)
    .filter((line) => !lineIsSupabaseKey(line) && line.trim() !== '')

  const merged = [...supabaseVars, '', ...otherVars].join('\n')
  writeFileSync(ENV_FILE, merged)

  const labels = {
    local: 'LOCAL (Docker)',
    dev: 'DEV (hosted)',
    prod: 'PROD (hosted)',
  }
  log(`✓ Switched to ${labels[target]}`, 'green')
  if (target === 'local') {
    log('Make sure Supabase is running: npm run supabase:start', 'blue')
  }
  if (target === 'prod') {
    log(
      'Caution: app now points at Prod. Prefer Dev for migrations and agent work.',
      'yellow',
    )
  }
  log('Restart your dev server (npm run dev) if it is running.', 'blue')
}

const raw = process.argv[2]
const command = raw === 'remote' ? 'prod' : raw === 'current' ? 'status' : raw

switch (command) {
  case 'local':
    switchTo('local')
    break
  case 'dev':
    switchTo('dev')
    break
  case 'prod':
    switchTo('prod')
    break
  case 'status':
    showCurrent()
    break
  default:
    console.log('Usage: npm run db:switch:{local|dev|prod|remote|status}')
    console.log('')
    console.log('Commands:')
    console.log('  db:switch:local   - Docker Supabase (optional)')
    console.log(
      '  db:switch:dev     - Hosted Dev (primary for agents / day-to-day)',
    )
    console.log(
      '  db:switch:prod    - Hosted Prod (promote / rare local checks)',
    )
    console.log('  db:switch:remote  - Alias for prod (legacy)')
    console.log('  db:switch:status  - Show current .env.local target')
    console.log('')
    showCurrent()
    process.exit(1)
}
