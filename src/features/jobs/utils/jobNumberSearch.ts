/**
 * Jobs index / list search helpers for matching `jobs.jobnr`.
 * UI often shows zero-padded forms (`#000042`); PostgREST needs the integer.
 */

/** Strip a leading `#` and surrounding whitespace from a search term. */
export function stripJobNumberSearchPrefix(search: string): string {
  return search.trim().replace(/^#/, '').trim()
}

/**
 * Parse a search string as a job number when it is entirely numeric
 * (optional leading `#`, optional zero padding).
 */
export function parseJobsSearchJobNumber(search: string): number | null {
  const trimmed = stripJobNumberSearchPrefix(search)
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) ? n : null
}

/** Display / Fuse haystacks for a job number (raw, padded, with `#`). */
export function jobNumberSearchHaystacks(
  jobnr: number | null | undefined,
): Array<string> {
  if (jobnr == null) return []
  const raw = String(jobnr)
  const padded = raw.padStart(6, '0')
  return [...new Set([raw, padded, `#${raw}`, `#${padded}`])]
}

/** Client-side: does this jobnr match the search term as a job number? */
export function jobMatchesJobNumberSearch(
  jobnr: number | null | undefined,
  search: string,
): boolean {
  const q = stripJobNumberSearchPrefix(search).toLowerCase()
  if (!q || jobnr == null) return false

  const parsed = parseJobsSearchJobNumber(search)
  if (parsed != null && jobnr === parsed) return true

  return jobNumberSearchHaystacks(jobnr).some((haystack) =>
    haystack.toLowerCase().includes(q),
  )
}
