import { afterEach, describe, expect, it } from 'vitest'
import { appEnv, isLocalSupabaseUrl, requireSupabaseClientEnv } from './env'

const envRecord = import.meta.env as Record<string, unknown>
const saved: Record<string, unknown> = {}

function setEnv(key: string, value: unknown) {
  if (!(key in saved)) saved[key] = envRecord[key]
  envRecord[key] = value
}

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete envRecord[key]
    else envRecord[key] = value
  }
  for (const key of Object.keys(saved)) delete saved[key]
})

describe('isLocalSupabaseUrl', () => {
  it('treats localhost and 127.0.0.1 Supabase URLs as local', () => {
    expect(isLocalSupabaseUrl('http://127.0.0.1:54321')).toBe(true)
    expect(isLocalSupabaseUrl('http://localhost:54321')).toBe(true)
    expect(isLocalSupabaseUrl('https://abc.supabase.co')).toBe(false)
    expect(isLocalSupabaseUrl('')).toBe(false)
  })
})

describe('appEnv', () => {
  it('reads google maps key and realtime disable flag', () => {
    setEnv('VITE_GOOGLE_MAPS_PLATFORM_API_KEY', 'maps-key')
    setEnv('VITE_DISABLE_APP_REALTIME', '1')
    expect(appEnv.googleMapsPlatformApiKey()).toBe('maps-key')
    expect(appEnv.disableAppRealtime()).toBe(true)
  })
})

describe('requireSupabaseClientEnv', () => {
  it('throws when URL or anon key is missing', () => {
    setEnv('VITE_SUPABASE_URL', '')
    setEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(() => requireSupabaseClientEnv()).toThrow(/VITE_SUPABASE_URL/)
  })
})
