import { isLocalSupabaseUrl as isLocalSupabaseUrlFromEnv } from '@shared/lib/env'

/**
 * Detects typical local Supabase URLs from Vite env.
 * Email Edge secrets are tied to the Supabase project this URL points at.
 */
export function isLocalSupabaseUrl(): boolean {
  return isLocalSupabaseUrlFromEnv()
}
