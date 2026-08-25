export type EmbeddedProfile = {
  user_id: string
  display_name: string | null
  email: string
  avatar_url: string | null
}

export function unwrapOne<T>(value: unknown): T | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return first == null ? null : (first as T)
  }
  return value as T
}

/**
 * PostgREST may return a related profile as an object or a one-element array.
 * When `expectedUserId` is set, only return a profile that actually matches —
 * never the first unrelated row.
 */
export function unwrapProfile(
  value: unknown,
  expectedUserId?: string | null,
): EmbeddedProfile | null {
  const rows = Array.isArray(value) ? value : value == null ? [] : [value]
  const profiles = rows.filter(
    (row): row is EmbeddedProfile =>
      !!row &&
      typeof row === 'object' &&
      typeof (row as { user_id?: unknown }).user_id === 'string',
  )

  if (expectedUserId) {
    return (
      profiles.find((profile) => profile.user_id === expectedUserId) ?? null
    )
  }

  return profiles[0] ?? null
}
