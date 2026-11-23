#!/usr/bin/env node
/**
 * Bump APP_VERSION in src/app/config/releaseNotes.ts.
 *
 * Usage:
 *   node scripts/bump-app-version.mjs           # patch +1
 *   node scripts/bump-app-version.mjs --minor   # minor +1, patch 0
 *   node scripts/bump-app-version.mjs --major   # major +1, minor/patch 0
 *   node scripts/bump-app-version.mjs --dry-run # print next version only
 *
 * Prints the new version to stdout (for CI).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RELEASE_NOTES_PATH = join(__dirname, '../src/app/config/releaseNotes.ts')

const APP_VERSION_RE = /export const APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/

/**
 * @param {string} source
 * @param {'patch' | 'minor' | 'major'} level
 * @returns {{ next: string, source: string }}
 */
export function bumpAppVersionSource(source, level = 'patch') {
  const match = source.match(APP_VERSION_RE)
  if (!match) {
    throw new Error(`Could not find APP_VERSION in ${RELEASE_NOTES_PATH}`)
  }

  let major = Number(match[1])
  let minor = Number(match[2])
  let patch = Number(match[3])

  if (level === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (level === 'minor') {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }

  const next = `${major}.${minor}.${patch}`
  const nextSource = source.replace(
    APP_VERSION_RE,
    `export const APP_VERSION = '${next}'`,
  )
  return { next, source: nextSource }
}

function parseArgs(argv) {
  let level = 'patch'
  let dryRun = false
  for (const arg of argv) {
    if (arg === '--major') level = 'major'
    else if (arg === '--minor') level = 'minor'
    else if (arg === '--patch') level = 'patch'
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--help' || arg === '-h') {
      console.error(
        'Usage: node scripts/bump-app-version.mjs [--patch|--minor|--major] [--dry-run]',
      )
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return { level, dryRun }
}

function main() {
  const { level, dryRun } = parseArgs(process.argv.slice(2))
  const current = readFileSync(RELEASE_NOTES_PATH, 'utf8')
  const { next, source } = bumpAppVersionSource(current, level)
  if (!dryRun) {
    writeFileSync(RELEASE_NOTES_PATH, source)
  }
  process.stdout.write(`${next}\n`)
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectRun) {
  main()
}
