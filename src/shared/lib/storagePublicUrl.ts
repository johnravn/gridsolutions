import { supabase } from '@shared/api/supabase'

type ResolveStoragePublicUrlOptions = {
  /** Append `?t=<ms>` so browsers refresh after replace-in-place uploads. */
  cacheBust?: boolean
  /**
   * When true, absolute http(s) paths (OAuth avatars, already-public URLs)
   * pass through unchanged instead of being treated as storage keys.
   */
  passThroughAbsoluteHttp?: boolean
}

/**
 * Resolve a Supabase storage object path to a public URL for `<img src>`.
 * Single place for bucket + optional cache-bust / absolute-URL pass-through.
 */
export function resolveStoragePublicUrl(
  bucket: string,
  path: string | null | undefined,
  options?: ResolveStoragePublicUrlOptions,
): string | null {
  if (path == null) return null
  const trimmed = path.trim()
  if (!trimmed) return null

  if (options?.passThroughAbsoluteHttp && /^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(trimmed)
  if (!data.publicUrl) return null
  if (options?.cacheBust) {
    return `${data.publicUrl}?t=${Date.now()}`
  }
  return data.publicUrl
}
