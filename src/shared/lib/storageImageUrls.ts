const SUPABASE_STORAGE_PUBLIC_PATH =
  /^https?:\/\/[^/]+\/storage\/v1\/(?:object|render\/image)\/public\/(.+?)(?:\?|$)/i

const PLACEHOLDER_WIDTH = 40
const PLACEHOLDER_QUALITY = 20

/** True when the URL path points at an SVG (query strings ignored). */
export function isSvgUrl(src: string): boolean {
  try {
    return new URL(src, 'https://local.invalid').pathname
      .toLowerCase()
      .endsWith('.svg')
  } catch {
    return false
  }
}

/** Build a tiny Supabase render URL for blur-up placeholders. Returns null for non-Supabase URLs. */
export function getBlurredPlaceholderUrl(
  src: string,
  options?: { width?: number; quality?: number },
): string | null {
  // Raster blur-up flattens SVG alpha onto an opaque plate.
  if (isSvgUrl(src)) return null

  const match = src.match(SUPABASE_STORAGE_PUBLIC_PATH)
  if (!match) return null

  const path = match[1]
  const origin = src.match(/^https?:\/\/[^/]+/i)?.[0]
  if (!origin) return null

  const width = options?.width ?? PLACEHOLDER_WIDTH
  const quality = options?.quality ?? PLACEHOLDER_QUALITY

  return `${origin}/storage/v1/render/image/public/${path}?width=${width}&quality=${quality}&resize=cover`
}

export function isSupabaseStorageUrl(src: string): boolean {
  return SUPABASE_STORAGE_PUBLIC_PATH.test(src)
}
