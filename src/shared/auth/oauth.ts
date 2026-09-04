import { supabase } from '@shared/api/supabase'
import type { Provider } from '@supabase/supabase-js'

export type OAuthProvider = Extract<Provider, 'google' | 'apple'>

export function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`
}

/** After OAuth linkIdentity, return to profile Sign-in methods tab. */
export function authLinkReturnUrl(): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent('/profile?tab=auth')}`
}

export async function signInWithOAuthProvider(provider: OAuthProvider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authCallbackUrl(),
      queryParams:
        provider === 'google'
          ? { access_type: 'offline', prompt: 'select_account' }
          : undefined,
    },
  })
}

export async function linkOAuthProvider(provider: OAuthProvider) {
  return supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo: authLinkReturnUrl(),
    },
  })
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
