/**
 * Single source for Vite client env reads used across app + shared.
 * Prefer these helpers over scattering `import.meta.env.VITE_*` casts.
 */

function readString(key: keyof ImportMetaEnv | string): string | undefined {
  const value = (import.meta.env as Record<string, unknown>)[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readFlag(key: keyof ImportMetaEnv | string): boolean {
  const value = (import.meta.env as Record<string, unknown>)[key]
  return value === 'true' || value === '1'
}

export const appEnv = {
  supabaseUrl: (): string | undefined => readString('VITE_SUPABASE_URL'),
  supabaseAnonKey: (): string | undefined =>
    readString('VITE_SUPABASE_ANON_KEY'),
  googleMapsPlatformApiKey: (): string | undefined =>
    readString('VITE_GOOGLE_MAPS_PLATFORM_API_KEY'),
  appPublicUrl: (): string | undefined => readString('VITE_APP_PUBLIC_URL'),
  disableAppRealtime: (): boolean => readFlag('VITE_DISABLE_APP_REALTIME'),
  contaApiUrl: (): string | undefined => readString('VITE_CONTA_API_URL'),
  contaApiUrlProd: (): string | undefined =>
    readString('VITE_CONTA_API_URL_PROD'),
  contaApiUrlSandbox: (): string | undefined =>
    readString('VITE_CONTA_API_URL_SANDBOX'),
  contaUseProductionInDev: (): boolean =>
    readFlag('VITE_CONTA_USE_PRODUCTION_IN_DEV'),
  isDev: (): boolean => Boolean(import.meta.env.DEV),
} as const

/** True when VITE_SUPABASE_URL points at a local Supabase stack. */
export function isLocalSupabaseUrl(
  url: string | undefined = appEnv.supabaseUrl(),
): boolean {
  if (!url) return false
  return /127\.0\.0\.1|localhost/i.test(url)
}

/** Require Supabase URL + anon key; fail loud if missing (boot contract). */
export function requireSupabaseClientEnv(): {
  url: string
  anonKey: string
} {
  const url = appEnv.supabaseUrl()
  const anonKey = appEnv.supabaseAnonKey()
  if (!url || !anonKey) {
    throw new Error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required. Check ENVIRONMENT_SETUP.md / Cursor secrets.',
    )
  }
  return { url, anonKey }
}
