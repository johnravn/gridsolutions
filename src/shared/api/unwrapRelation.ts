/**
 * PostgREST may return an embedded relation as an object or a one-element array.
 * Single authoritative unwrap for join shapes across features.
 */
export function unwrapRelation<T>(value: unknown): T | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return first == null ? null : (first as T)
  }
  return value as T
}
