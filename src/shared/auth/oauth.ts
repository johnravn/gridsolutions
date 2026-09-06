import { supabase } from '@shared/api/supabase'
import type { Provider } from '@supabase/supabase-js'

export type OAuthProvider = Extract<Provider, 'google'>

const PENDING_OAUTH_KEY = 'grid:pending-oauth-provider'

/**
 * Local Supabase `site_url` is 127.0.0.1. PKCE stores the code verifier on the
 * page origin, so localhost vs 127.0.0.1 breaks the callback exchange.
 */
export function canonicalAppOrigin(): string {
  const { protocol, hostname, port } = window.location
  const host = hostname === 'localhost' ? '127.0.0.1' : hostname
  const portPart = port ? `:${port}` : ''
  return `${protocol}//${host}${portPart}`
}

/** If on localhost, rewrite to 127.0.0.1 and return true (navigation started). */
export function rewriteLocalhostToLoopback(): boolean {
  if (window.location.hostname !== 'localhost') return false
  const url = new URL(window.location.href)
  url.hostname = '127.0.0.1'
  window.location.replace(url.toString())
  return true
}

export function authCallbackUrl(): string {
  return `${canonicalAppOrigin()}/auth/callback`
}

/** After OAuth linkIdentity, return to profile Sign-in methods tab. */
export function authLinkReturnUrl(): string {
  return `${canonicalAppOrigin()}/auth/callback?next=${encodeURIComponent('/profile?tab=auth')}`
}

export async function signInWithOAuthProvider(provider: OAuthProvider) {
  if (window.location.hostname === 'localhost') {
    sessionStorage.setItem(PENDING_OAUTH_KEY, provider)
    rewriteLocalhostToLoopback()
    return { data: { provider, url: null }, error: null }
  }

  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authCallbackUrl(),
      queryParams: { access_type: 'offline', prompt: 'select_account' },
    },
  })
}

/** Resume Google OAuth after a localhost → 127.0.0.1 rewrite. */
export async function resumePendingOAuthProvider() {
  const pending = sessionStorage.getItem(PENDING_OAUTH_KEY)
  if (pending !== 'google') return null
  sessionStorage.removeItem(PENDING_OAUTH_KEY)
  return signInWithOAuthProvider(pending)
}

export async function linkOAuthProvider(provider: OAuthProvider) {
  if (window.location.hostname === 'localhost') {
    sessionStorage.setItem(PENDING_OAUTH_KEY, `link:${provider}`)
    rewriteLocalhostToLoopback()
    return { data: { provider, url: null }, error: null }
  }

  return supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo: authLinkReturnUrl(),
    },
  })
}

export async function resumePendingOAuthLink() {
  const pending = sessionStorage.getItem(PENDING_OAUTH_KEY)
  if (!pending?.startsWith('link:')) return null
  sessionStorage.removeItem(PENDING_OAUTH_KEY)
  const provider = pending.slice('link:'.length)
  if (provider !== 'google') return null
  return linkOAuthProvider(provider)
}

export type ProfileCompleteness = {
  first_name: string | null
  last_name: string | null
  phone: string | null
}

export function isProfileComplete(
  profile: ProfileCompleteness | null | undefined,
): boolean {
  if (!profile) return false
  return (
    Boolean(profile.first_name?.trim()) &&
    Boolean(profile.last_name?.trim()) &&
    Boolean(profile.phone?.trim())
  )
}

export async function fetchProfileCompleteness(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
