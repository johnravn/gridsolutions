/**
 * Runs `supabase status -o env` using the system CLI (not node_modules/.bin),
 * so npm scripts get the same keys as running Supabase locally in the shell.
 */
import { execSync } from 'node:child_process'

const LOCAL_HOSTS = ['127.0.0.1', 'localhost']

function execEnvWithoutLocalBin() {
  const pathEntries = (process.env.PATH ?? '').split(':').filter(Boolean)
  const filtered = pathEntries.filter(
    (entry) => !entry.includes('node_modules/.bin'),
  )
  return {
    ...process.env,
    PATH: filtered.length > 0 ? filtered.join(':') : process.env.PATH,
  }
}

function decodeJwtAlg(token) {
  try {
    const header = token.split('.')[0]
    const padded = header.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(padded, 'base64').toString('utf-8')
    return JSON.parse(json).alg
  } catch {
    return null
  }
}

export function readSupabaseStatusEnv() {
  let output = ''
  try {
    output = execSync('supabase status -o env 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      env: execEnvWithoutLocalBin(),
    })
  } catch {
    return null
  }

  const parsed = {}
  for (const line of output.split('\n')) {
    const match = line.match(/^([A-Z_]+)="([^"]*)"$/)
    if (!match) continue
    parsed[match[1]] = match[2]
  }

  if (!parsed.API_URL || !parsed.SERVICE_ROLE_KEY || !parsed.ANON_KEY) {
    return null
  }

  return {
    url: parsed.API_URL,
    serviceRoleKey: parsed.SERVICE_ROLE_KEY,
    anonKey: parsed.ANON_KEY,
  }
}

function readProcessEnvSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!url || !serviceRoleKey || !anonKey) return null

  return { url, serviceRoleKey, anonKey }
}

function applySupabaseEnv(config) {
  process.env.SUPABASE_URL = config.url
  process.env.VITE_SUPABASE_URL = config.url
  process.env.SUPABASE_SERVICE_ROLE_KEY = config.serviceRoleKey
  process.env.VITE_SUPABASE_ANON_KEY = config.anonKey
  return config
}

export function loadLocalSupabaseEnv() {
  const status = readSupabaseStatusEnv()
  if (!status) {
    const fromEnv = readProcessEnvSupabaseConfig()
    return fromEnv ? applySupabaseEnv(fromEnv) : null
  }

  const isLocal = LOCAL_HOSTS.some((host) => status.url.includes(host))
  const alg = decodeJwtAlg(status.serviceRoleKey)
  if (isLocal && alg === 'HS256') {
    // CI exports keys from `supabase status` before seed; fresh local stacks may
    // still use legacy HS256 JWTs that work fine with the running containers.
    const fromEnv = readProcessEnvSupabaseConfig()
    if (fromEnv) return applySupabaseEnv(fromEnv)

    throw new Error(
      'Local Supabase returned a legacy HS256 service role key. Run `supabase stop && supabase start` with the system CLI and retry.',
    )
  }

  return applySupabaseEnv(status)
}
