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

export function loadLocalSupabaseEnv() {
  const status = readSupabaseStatusEnv()
  if (!status) return null

  const isLocal = LOCAL_HOSTS.some((host) => status.url.includes(host))
  const alg = decodeJwtAlg(status.serviceRoleKey)
  if (isLocal && alg === 'HS256') {
    throw new Error(
      'Local Supabase returned a legacy HS256 service role key. Run `supabase stop && supabase start` with the system CLI and retry.',
    )
  }

  process.env.SUPABASE_URL = status.url
  process.env.VITE_SUPABASE_URL = status.url
  process.env.SUPABASE_SERVICE_ROLE_KEY = status.serviceRoleKey
  process.env.VITE_SUPABASE_ANON_KEY = status.anonKey

  return status
}
