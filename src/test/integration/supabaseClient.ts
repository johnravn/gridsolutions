import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@shared/types/database.types'

const DEFAULT_URL = 'http://127.0.0.1:54321'

function decodeJwtAlg(token: string): string | null {
  try {
    const header = token.split('.')[0]
    const padded = header.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')).alg
  } catch {
    return null
  }
}

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

function loadFromCli() {
  try {
    const output = execSync('supabase status -o env 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      env: execEnvWithoutLocalBin(),
    })
    const parsed: Record<string, string> = {}
    for (const line of output.split('\n')) {
      const match = line.match(/^([A-Z_]+)="([^"]*)"$/)
      if (match) parsed[match[1]] = match[2]
    }
    if (!parsed.API_URL || !parsed.ANON_KEY || !parsed.SERVICE_ROLE_KEY) {
      return null
    }
    const isLocal = ['127.0.0.1', 'localhost'].some((host) =>
      parsed.API_URL.includes(host),
    )
    if (isLocal && decodeJwtAlg(parsed.SERVICE_ROLE_KEY) === 'HS256') {
      return null
    }
    return {
      url: parsed.API_URL,
      anonKey: parsed.ANON_KEY,
      serviceRoleKey: parsed.SERVICE_ROLE_KEY,
    }
  } catch {
    return null
  }
}

export function getSupabaseTestConfig() {
  const fromCli = loadFromCli()
  if (fromCli) return fromCli

  return {
    url:
      process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? DEFAULT_URL,
    anonKey:
      process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

export function createAnonClient() {
  const { url, anonKey } = getSupabaseTestConfig()
  if (!anonKey) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is required. Run `supabase start` or set env from `supabase status -o env`.',
    )
  }
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createServiceClient() {
  const { url, serviceRoleKey } = getSupabaseTestConfig()
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service client')
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function isSupabaseReachable(): Promise<boolean> {
  try {
    const client = createAnonClient()
    const { error } = await client.from('companies').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

export async function signInTestUser(email: string, password: string) {
  const client = createAnonClient()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return { client, session: data.session }
}

export const integrationEnabled =
  process.env.RUN_INTEGRATION_TESTS === '1' || process.env.CI === 'true'
