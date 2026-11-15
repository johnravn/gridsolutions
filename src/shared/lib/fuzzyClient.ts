import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

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
