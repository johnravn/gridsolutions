import { supabase } from '@shared/api/supabase'

/**
 * Resolve a profile avatar for `<img src>`.
 *
 * OAuth providers (e.g. Google) store absolute URLs in `profiles.avatar_url`.
 * Uploaded avatars store relative storage keys like `userId/avatar.jpg`.
 * Always pass absolute http(s) through unchanged; only prefix relative keys
 * with the public `avatars` bucket URL.
 */
export function resolveAvatarUrl(
  avatarPath: string | null | undefined,
): string | null {
  if (avatarPath == null) return null
  const trimmed = avatarPath.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const { data } = supabase.storage.from('avatars').getPublicUrl(trimmed)
  return data.publicUrl
}
