/**
 * Detects typical local Supabase URLs from Vite env.
 * Email Edge secrets are tied to the Supabase project this URL points at.
 */
export function isLocalSupabaseUrl(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (typeof url !== 'string' || !url) return false
  return url.includes('127.0.0.1') || url.includes('localhost')
}
