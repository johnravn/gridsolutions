/**
 * Fuzzy search utilities for database queries.
 * PostgREST can't call pg_trgm operators directly, so we expand ILIKE patterns
 * to pull in typo candidates; client Fuse ranks/filters after fetch.
 */

/** Strip characters that break PostgREST `or=(...)` expressions. */
export function escapeForPostgrestOr(value: string) {
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * ILIKE patterns that treat spaces as optional and tolerate a single-letter
 * typo (substitution via `_`, or one dropped character).
 *
 * Needed so server prefilters don't drop rows before client Fuse can rank
 * them — e.g. `ungdsmfest` → `ungdomsfest`.
 */
export function postgrestIlikePatterns(term: string): Array<string> {
  const safe = escapeForPostgrestOr(term)
  if (!safe) return []
  const compact = safe.replace(/\s+/g, '')
  const patterns = [`%${safe}%`]
  if (compact && compact !== safe) patterns.push(`%${compact}%`)
  if (compact.length > 2) {
    patterns.push(`%${compact.split('').join('%')}%`)
    for (let i = 0; i < compact.length; i++) {
      patterns.push(`%${compact.slice(0, i)}_${compact.slice(i + 1)}%`)
      const dropped = compact.slice(0, i) + compact.slice(i + 1)
      if (dropped.length > 2) {
        patterns.push(`%${dropped.split('').join('%')}%`)
      }
    }
  }
  return [...new Set(patterns)]
}

/**
 * Applies fuzzy search to a PostgREST query builder via expanded ILIKE patterns.
 */
export function applyFuzzySearch(
  query: { or: (filter: string) => unknown },
  searchTerm: string,
  columns: Array<string>,
): unknown {
  if (!searchTerm || !searchTerm.trim()) return query

  const patterns = postgrestIlikePatterns(searchTerm)
  if (patterns.length === 0 || columns.length === 0) return query

  const conditions = columns.flatMap((col) =>
    patterns.map((pattern) => `${col}.ilike.${pattern}`),
  )

  return query.or(conditions.join(','))
}

/**
 * @deprecated Prefer applyFuzzySearch / postgrestIlikePatterns. Kept for callers
 * that expected an RPC-based path.
 */
export async function fuzzySearchRPC<T>(
  _table: string,
  searchTerm: string,
  _searchColumns: Array<string>,
  baseQuery?: { then?: unknown } & PromiseLike<{
    data: unknown
    error: unknown
  }>,
): Promise<Array<T>> {
  if (!searchTerm || !searchTerm.trim()) {
    if (baseQuery) {
      const { data, error } = await baseQuery
      if (error) throw error
      return (data || []) as Array<T>
    }
    return []
  }

  throw new Error('fuzzySearchRPC not yet implemented - use applyFuzzySearch')
}
