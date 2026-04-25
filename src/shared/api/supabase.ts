import { createClient } from '@supabase/supabase-js'
import type { Database } from '@shared/types/database.types'

// These come from your Supabase project settings
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function makeInstrumentedFetch() {
  const isDev = import.meta.env.DEV
  if (!isDev) return fetch

  const counts = new Map<
    string,
    { n: number; ms: number; bytes: number; errors: number }
  >()
  let lastFlushAt = 0

  function safeBytesFromHeaders(headers: Headers) {
    const len = headers.get('content-length')
    const n = len ? Number(len) : NaN
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  function flushIfNeeded() {
    const now = Date.now()
    if (now - lastFlushAt < 30_000) return
    lastFlushAt = now

    const top = Array.from(counts.entries())
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .slice(0, 15)
      .map(([k, v]) => ({
        key: k,
        n: v.n,
        ms: Math.round(v.ms),
        bytes: v.bytes,
        errors: v.errors,
      }))

    if (top.length > 0) {
      console.log('[supabase] top network (approx)', top)
    }
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now()
    let key = 'unknown'
    try {
      const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url,
      )
      key = `${(init?.method || 'GET').toUpperCase()} ${url.pathname}`
    } catch {
      // ignore
    }

    try {
      const res = await fetch(input, init)
      const ms = performance.now() - started
      const bytes = safeBytesFromHeaders(res.headers)
      const prev = counts.get(key) ?? { n: 0, ms: 0, bytes: 0, errors: 0 }
      counts.set(key, {
        n: prev.n + 1,
        ms: prev.ms + ms,
        bytes: prev.bytes + bytes,
        errors: prev.errors + (res.ok ? 0 : 1),
      })
      flushIfNeeded()
      return res
    } catch (e) {
      const ms = performance.now() - started
      const prev = counts.get(key) ?? { n: 0, ms: 0, bytes: 0, errors: 0 }
      counts.set(key, {
        n: prev.n + 1,
        ms: prev.ms + ms,
        bytes: prev.bytes,
        errors: prev.errors + 1,
      })
      flushIfNeeded()
      throw e
    }
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: makeInstrumentedFetch(),
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We handle OAuth/callback manually
    flowType: 'pkce',
  },
})
