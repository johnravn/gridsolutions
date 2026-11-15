import { resolveStoragePublicUrl } from './storagePublicUrl'

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
  return resolveStoragePublicUrl('avatars', avatarPath, {
    passThroughAbsoluteHttp: true,
  })
}
