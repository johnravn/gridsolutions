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
 * Fuzzy search utility functions
 */

function compactWhitespace(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '')
}

function compactChars(text: string): {
  compact: string
  indices: Array<number>
} {
  const indices: Array<number> = []
  let compact = ''
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue
    indices.push(i)
    compact += text[i].toLowerCase()
  }
  return { compact, indices }
}

/** Adjacent transpositions count as one edit (typos like "shrue" vs "shure"). */
function damerauLevenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const dp: Array<Array<number>> = Array.from({ length: m + 1 }, (_, i) => {
    const row = Array.from({ length: n + 1 }, () => 0)
    row[0] = i
    return row
  })
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1)
      }
    }
  }
  return dp[m][n]
}

function maxAllowedEdits(searchLen: number): number {
  if (searchLen < 3) return 0
  return Math.max(1, Math.floor(searchLen / 3))
}

function bestEditWindow(
  search: string,
  target: string,
): { start: number; end: number; distance: number } | null {
  const maxEdits = maxAllowedEdits(search.length)
  if (maxEdits === 0 || !target) return null

  let bestStart = 0
  let bestEnd = target.length
  let bestDistance = damerauLevenshtein(search, target)
  if (bestDistance > maxEdits) bestDistance = Number.POSITIVE_INFINITY

  const minLen = Math.max(1, search.length - maxEdits)
  const maxLen = Math.min(target.length, search.length + maxEdits)
  for (let len = minLen; len <= maxLen; len++) {
    for (let start = 0; start <= target.length - len; start++) {
      const distance = damerauLevenshtein(
        search,
        target.slice(start, start + len),
      )
      if (distance > maxEdits) continue
      const betterDistance = distance < bestDistance
      const sameDistanceShorter =
        distance === bestDistance && len < bestEnd - bestStart
      const sameDistanceEarlier =
        distance === bestDistance &&
        len === bestEnd - bestStart &&
        start < bestStart
      if (betterDistance || sameDistanceShorter || sameDistanceEarlier) {
        bestStart = start
        bestEnd = start + len
        bestDistance = distance
        if (distance === 0) {
          return { start: bestStart, end: bestEnd, distance: bestDistance }
        }
      }
    }
  }

  if (!Number.isFinite(bestDistance)) return null
  return { start: bestStart, end: bestEnd, distance: bestDistance }
}

function typoMatchScore(search: string, target: string): number {
  const window = bestEditWindow(search, target)
  if (!window) return 0
  const windowLen = window.end - window.start
  const similarity = 1 - window.distance / Math.max(search.length, windowLen)
  const prefixBonus = window.start === 0 ? 0.12 : 0
  return Math.min(0.82, similarity * 0.7 + prefixBonus)
}

function typoMatchRange(
  searchTerm: string,
  text: string,
): Array<FuzzyMatchRange> {
  const compactSearch = compactWhitespace(searchTerm)
  const { compact, indices } = compactChars(text)
  const window = bestEditWindow(compactSearch, compact)
  if (!window) return []
  const start = indices[window.start]
  const end = indices[window.end - 1] + 1
  return [{ start, end }]
}

/**
 * Calculates fuzzy match score between two strings (0-1)
 * Uses substring matching plus Damerau-Levenshtein for typos ("share" → "Shure").
 * Whitespace is optional, so "1 ch" matches "1ch".
 */
export function fuzzyMatchScore(searchTerm: string, text: string): number {
  if (!searchTerm || !text) return 0

  const search = searchTerm.toLowerCase().trim().replace(/\s+/g, ' ')
  const target = text.toLowerCase().trim()
  if (!search) return 0

  const compactSearch = compactWhitespace(search)
  const compactTarget = compactWhitespace(target)

  // Exact match (raw or ignoring spaces)
  if (target === search || compactTarget === compactSearch) return 1

  // Starts with search term
  if (target.startsWith(search) || compactTarget.startsWith(compactSearch)) {
    return 0.9
  }

  // Contains search term as whole word
  const wordRegex = new RegExp(
    `\\b${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'i',
  )
  if (wordRegex.test(target)) return 0.8

  // Contains search term anywhere (raw or ignoring spaces)
  if (target.includes(search) || compactTarget.includes(compactSearch)) {
    return 0.7
  }

  const tokens = search.split(' ').filter(Boolean)
  if (tokens.length > 1) {
    let pos = 0
    let inOrder = true
    for (const token of tokens) {
      const idx = compactTarget.indexOf(token, pos)
      if (idx < 0) {
        inOrder = false
        break
      }
      pos = idx + token.length
    }
    if (inOrder) return 0.85

    const allPresent = tokens.every(
      (token) => target.includes(token) || compactTarget.includes(token),
    )
    if (allPresent) return 0.75
  }

  // Sequential characters, skipping spaces in the query
  let searchIdx = 0
  for (let i = 0; i < target.length && searchIdx < search.length; i++) {
    while (searchIdx < search.length && search[searchIdx] === ' ') searchIdx++
    if (searchIdx >= search.length) break
    if (target[i] === search[searchIdx]) searchIdx++
  }
  while (searchIdx < search.length && search[searchIdx] === ' ') searchIdx++
  if (searchIdx === search.length) {
    const spread = target.length - compactSearch.length
    return Math.max(0.3, 0.6 - spread * 0.05)
  }

  return typoMatchScore(compactSearch, compactTarget)
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
  if (!searchTerm.trim()) return items

  const scored = items
    .map((item) => {
      let maxScore = 0
      for (const field of fields) {
        const text = field(item)
        if (text) {
          const score = fuzzyMatchScore(searchTerm, text)
          maxScore = Math.max(maxScore, score)
        }
      }
      return { item, score: maxScore }
    })
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score) // Sort by score descending

  return scored.map(({ item }) => item)
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

function sequentialMatchIndices(search: string, text: string): Array<number> {
  const lowerText = text.toLowerCase()
  const indices: Array<number> = []
  let searchIdx = 0
  for (let i = 0; i < lowerText.length && searchIdx < search.length; i++) {
    if (lowerText[i] === search[searchIdx]) {
      indices.push(i)
      searchIdx++
    }
  }
  return searchIdx === search.length ? indices : []
}

function indicesToRanges(indices: Array<number>): Array<FuzzyMatchRange> {
  if (indices.length === 0) return []
  const ranges: Array<FuzzyMatchRange> = []
  let start = indices[0]
  let end = indices[0] + 1
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === end) {
      end = indices[i] + 1
    } else {
      ranges.push({ start, end })
      start = indices[i]
      end = indices[i] + 1
    }
  }
  ranges.push({ start, end })
  return ranges
}

function compactSubstringRange(
  searchTerm: string,
  text: string,
): Array<FuzzyMatchRange> {
  const compactSearch = compactWhitespace(searchTerm)
  if (!compactSearch) return []

  const { compact, indices } = compactChars(text)
  const idx = compact.indexOf(compactSearch)
  if (idx < 0) return []
  const start = indices[idx]
  const end = indices[idx + compactSearch.length - 1] + 1
  return [{ start, end }]
}

/**
 * Character ranges to bold in `text` for a fuzzy query.
 * Prefers a contiguous substring, then ignoring spaces, then per-token matches,
 * then the closest typo window (one swapped letter, etc.).
 */
export function getFuzzyMatchRanges(
  searchTerm: string,
  text: string,
): Array<FuzzyMatchRange> {
  if (!searchTerm.trim() || !text) return []

  const lowerText = text.toLowerCase()
  const lowerSearch = searchTerm.trim().toLowerCase().replace(/\s+/g, ' ')

  const substringIdx = lowerText.indexOf(lowerSearch)
  if (substringIdx >= 0) {
    return [{ start: substringIdx, end: substringIdx + lowerSearch.length }]
  }

  const compactRange = compactSubstringRange(lowerSearch, text)
  if (compactRange.length > 0) return compactRange

  const tokens = lowerSearch.split(' ').filter(Boolean)
  if (tokens.length > 1) {
    const ranges: Array<FuzzyMatchRange> = []
    for (const token of tokens) {
      ranges.push(...getFuzzyMatchRanges(token, text))
    }
    const merged = mergeFuzzyMatchRanges(ranges)
    if (merged.length > 0) return merged
  }

  const sequential = indicesToRanges(sequentialMatchIndices(lowerSearch, text))
  if (sequential.length > 0) return sequential

  return typoMatchRange(lowerSearch, text)
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
