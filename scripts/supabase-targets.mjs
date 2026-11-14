/**
 * Shared helpers for Dev / Prod / local Supabase targets.
 * Prod project ref is fixed; Dev ref comes from .env.dev.db or env.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export const ROOT = process.cwd()
export const PROD_PROJECT_REF = 'tlpgejkglrgoljgvpubn'
export const PROD_URL = `https://${PROD_PROJECT_REF}.supabase.co`

export const ENV_FILES = {
  local: join(ROOT, '.env.local.db'),
  dev: join(ROOT, '.env.dev.db'),
  /** Prod profile — filename kept for backward compatibility */
  prod: join(ROOT, '.env.remote.db'),
}

export const SUPABASE_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_SERVICE_ROLE_KEY',
]

/** @param {string} line */
export function lineIsSupabaseKey(line) {
  const trimmed = line.trim()
  return SUPABASE_KEYS.some((key) => trimmed.startsWith(key + '='))
}

/**
 * Parse KEY=VALUE lines from an env-style file (no export, simple form).
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseEnvContent(content) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/**
 * @param {string} filePath
 * @returns {Record<string, string> | null}
 */
export function readEnvFile(filePath) {
  if (!existsSync(filePath)) return null
  return parseEnvContent(readFileSync(filePath, 'utf-8'))
}

/**
 * @param {Record<string, string>} env
 * @returns {string[]}
 */
export function supabaseLinesFromEnv(env) {
  return SUPABASE_KEYS.filter((key) => env[key] != null && env[key] !== '').map(
    (key) => `${key}=${env[key]}`,
  )
}

/**
 * Resolve hosted Dev project ref.
 * Order: SUPABASE_DEV_PROJECT_REF env → .env.dev.db SUPABASE_PROJECT_REF
 * @returns {string | null}
 */
export function resolveDevProjectRef() {
  const fromEnv = process.env.SUPABASE_DEV_PROJECT_REF?.trim()
  if (fromEnv) return fromEnv
  const file = readEnvFile(ENV_FILES.dev)
  const ref = file?.SUPABASE_PROJECT_REF?.trim()
  if (ref && ref !== 'YOUR_DEV_REF' && !ref.includes('YOUR_')) return ref
  return null
}

/**
 * @param {'dev' | 'prod'} target
 * @returns {string}
 */
export function expectedRefForTarget(target) {
  if (target === 'prod') return PROD_PROJECT_REF
  const ref = resolveDevProjectRef()
  if (!ref) {
    throw new Error(
      'Dev project ref unknown. Create the Dev project, then set SUPABASE_PROJECT_REF in .env.dev.db (or SUPABASE_DEV_PROJECT_REF).',
    )
  }
  return ref
}

/**
 * Read currently linked CLI project ref (supabase/.temp/project-ref), if any.
 * @returns {string | null}
 */
export function readLinkedProjectRef() {
  const path = join(ROOT, 'supabase', '.temp', 'project-ref')
  if (!existsSync(path)) return null
  const ref = readFileSync(path, 'utf-8').trim()
  return ref || null
}

/**
 * Classify an active .env.local (or similar) as local | dev | prod | unknown.
 * @param {string} content
 * @returns {'local' | 'dev' | 'prod' | 'unknown'}
 */
export function classifyEnvContent(content) {
  if (
    content.includes('127.0.0.1:54321') ||
    content.includes('localhost:54321')
  ) {
    return 'local'
  }
  const env = parseEnvContent(content)
  const url = env.VITE_SUPABASE_URL ?? ''
  const ref = env.SUPABASE_PROJECT_REF ?? ''
  if (ref === PROD_PROJECT_REF || url.includes(PROD_PROJECT_REF)) {
    return 'prod'
  }
  if (url.includes('.supabase.co')) {
    return 'dev'
  }
  return 'unknown'
}
