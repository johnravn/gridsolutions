import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

/** YYYY-MM-DD in local time (avoids UTC date shift from `toISOString().slice(0, 10)`). */
export function formatLocalYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Add whole calendar days in local time (stable across DST vs raw millisecond math). */
export function addLocalCalendarDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function makeWordPresentable(str: string): string {
  if (!str) return str
  const cleaned = str.replace(/[_-]+/g, ' ')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function fmtVAT(str: string | null | undefined): string {
  if (!str || str.trim() === '') return '—'
  // Remove any existing spaces/dashes for formatting
  const cleaned = str.replace(/[\s-]/g, '')
  // Format as "xxx xxx xxx" if we have 9 digits
  if (cleaned.length === 9) {
    return (
      cleaned.slice(0, 3) + ' ' + cleaned.slice(3, 6) + ' ' + cleaned.slice(6)
    )
  }
  // For other lengths, just return the cleaned string
  return cleaned
}

/**
 * Formats VAT number input as user types: "xxx xxx xxx"
 * Removes non-digits and formats with spaces
 */
export function formatVATInput(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')

  // Limit to 9 digits
  const limited = digits.slice(0, 9)

  // Format as "xxx xxx xxx"
  if (limited.length <= 3) {
    return limited
  } else if (limited.length <= 6) {
    return `${limited.slice(0, 3)} ${limited.slice(3)}`
  } else {
    return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`
  }
}

/**
 * Adds 3 hours to a datetime ISO string and returns a new ISO string
 */
export function addThreeHours(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  date.setHours(date.getHours() + 3)
  return date.toISOString()
}

/**
 * Client-side fuzzy search (Fuse.js). Postgres `ilike` / `pg_trgm` still
 * filter fetches; these helpers rank and highlight after results are loaded.
 */

/** Fuse Bitap cutoff (0 = exact, 1 = match anything). */
const FUSE_THRESHOLD = 0.4

function createFuseOptions<T>(keys: IFuseOptions<T>['keys']): IFuseOptions<T> {
  return {
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    ignoreDiacritics: true,
    shouldSort: true,
    threshold: FUSE_THRESHOLD,
    useTokenSearch: true,
    tokenMatch: 'all',
    keys,
  }
}

function fuseSimilarity(score: number | undefined): number {
  if (score === undefined) return 0
  return 1 - score
}

/**
 * Similarity between two strings (0–1) from Fuse.js.
 * Multi-word queries use token AND matching; whitespace-split tokens still
 * match compacted labels (`"1 ch"` → `"1ch"`).
 */
export function fuzzyMatchScore(searchTerm: string, text: string): number {
  if (!searchTerm.trim() || !text) return 0
  const fuse = new Fuse(
    [{ value: text }],
    createFuseOptions<{ value: string }>(['value']),
  )
  const result = fuse.search(searchTerm.trim())[0]
  if (!result) return 0
  return fuseSimilarity(result.score)
}

/**
 * Checks if text matches search term with fuzzy matching
 * @param searchTerm - The search term
 * @param text - The text to search in
 * @param threshold - Minimum similarity score (0-1), default 0.3
 * @returns true if match score >= threshold
 */
export function fuzzyMatch(
  searchTerm: string,
  text: string | null | undefined,
  threshold = 0.3,
): boolean {
  if (!text || !searchTerm) return false
  return fuzzyMatchScore(searchTerm, text) >= threshold
}

/**
 * Filters an array of items based on fuzzy matching across multiple fields
 * @param items - Array of items to filter
 * @param searchTerm - Search term
 * @param fields - Array of field accessor functions that return strings to search
 * @param threshold - Minimum similarity score (0-1), default 0.3
 * @returns Filtered array sorted by match score (highest first)
 */
export function fuzzySearch<T>(
  items: Array<T>,
  searchTerm: string,
  fields: Array<(item: T) => string | null | undefined>,
  threshold = 0.3,
): Array<T> {
  const query = searchTerm.trim()
  if (!query) return items
  if (items.length === 0) return items

  const fuse = new Fuse(
    items,
    createFuseOptions<T>(
      fields.map((field, index) => ({
        name: String(index),
        getFn: (item: T) => {
          const value = field(item)
          return value ? value : null
        },
      })),
    ),
  )

  return fuse
    .search(query)
    .filter((result) => fuseSimilarity(result.score) >= threshold)
    .map((result) => result.item)
}

export type FuzzyMatchRange = { start: number; end: number }

function mergeFuzzyMatchRanges(
  ranges: Array<FuzzyMatchRange>,
): Array<FuzzyMatchRange> {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: Array<FuzzyMatchRange> = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const next = sorted[i]
    if (next.start <= last.end) {
      last.end = Math.max(last.end, next.end)
    } else {
      merged.push({ ...next })
    }
  }
  return merged
}

/**
 * Character ranges to bold in `text` for a fuzzy query.
 * Uses Fuse.js match indices (inclusive) converted to `[start, end)` slices.
 */
export function getFuzzyMatchRanges(
  searchTerm: string,
  text: string,
): Array<FuzzyMatchRange> {
  if (!searchTerm.trim() || !text) return []

  const fuse = new Fuse(
    [{ value: text }],
    createFuseOptions<{ value: string }>(['value']),
  )
  const result = fuse.search(searchTerm.trim())[0]
  if (!result?.matches) return []

  const ranges: Array<FuzzyMatchRange> = []
  for (const match of result.matches) {
    for (const [start, end] of match.indices) {
      ranges.push({ start, end: end + 1 })
    }
  }
  return mergeFuzzyMatchRanges(ranges)
}

/**
 * Generates initials from a display name or email.
 * For names with multiple words, uses first letter of first word + first letter of last word.
 * For single words or emails, uses first 2 characters.
 *
 * @param nameOrEmail - Display name or email address
 * @returns Initials string (e.g., "John Ravndal" -> "JR", "john@example.com" -> "JO")
 */
export function getInitials(nameOrEmail: string | null | undefined): string {
  const base = (nameOrEmail || '').trim()
  if (!base) return '?'

  const parts = base.split(/\s+/).filter(Boolean)

  // If we have 2+ words, use first letter of first word + first letter of last word
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // For single word or email, use first 2 characters
  return base.slice(0, 2).toUpperCase()
}

/**
 * Generates initials from a name (with fallback to email).
 * For names with multiple words, uses first letter of first word + first letter of last word.
 *
 * @param name - Display name (can be null)
 * @param email - Email address (used as fallback if name is not available)
 * @returns Initials string (e.g., "John Ravndal" -> "JR", "john@example.com" -> "JO")
 */
export function getInitialsFromNameOrEmail(
  name: string | null | undefined,
  email: string,
): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}
