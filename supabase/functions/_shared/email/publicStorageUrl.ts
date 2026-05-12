/**
 * Build public Storage object URLs for Edge Functions (no Supabase JS client).
 * Matches browser `supabase.storage.from(bucket).getPublicUrl(path)`.
 */

const SUPABASE_URL_TRAILING_SLASH = /\/$/

/**
 * @param supabaseUrl - `SUPABASE_URL` (e.g. https://xxx.supabase.co)
 * @param bucket - Storage bucket id (e.g. `logos`)
 * @param path - Object path inside the bucket (may contain `/`)
 */
export function publicStorageObjectUrl(
  supabaseUrl: string,
  bucket: string,
  path: string,
): string {
  const base = supabaseUrl.replace(SUPABASE_URL_TRAILING_SLASH, '')
  const encodedPath = encodeURI(path)
  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`
}

/** Public URL for an object in the `logos` bucket. */
export function publicLogoUrl(supabaseUrl: string, path: string): string {
  return publicStorageObjectUrl(supabaseUrl, 'logos', path)
}

export function preferredCompanyLogoPath(company: {
  logo_light_path?: string | null
  logo_dark_path?: string | null
  logo_path?: string | null
}): string | null {
  const a = company.logo_light_path?.trim()
  const b = company.logo_dark_path?.trim()
  const c = company.logo_path?.trim()
  return a || b || c || null
}
