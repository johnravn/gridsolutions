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

/**
 * Calculates fuzzy match score between two strings (0-1)
 * Uses a combination of substring matching and Levenshtein-like distance
 */
export function fuzzyMatchScore(searchTerm: string, text: string): number {
  if (!searchTerm || !text) return 0

  const search = searchTerm.toLowerCase().trim()
  const target = text.toLowerCase().trim()

  // Exact match
  if (target === search) return 1

  // Starts with search term
  if (target.startsWith(search)) return 0.9

  // Contains search term as whole word
  const wordRegex = new RegExp(
    `\\b${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'i',
  )
  if (wordRegex.test(target)) return 0.8

  // Contains search term anywhere
  if (target.includes(search)) return 0.7

  // Check if all characters of search term appear in order (fuzzy substring)
  let searchIdx = 0
  for (let i = 0; i < target.length && searchIdx < search.length; i++) {
    if (target[i] === search[searchIdx]) {
      searchIdx++
    }
  }
  if (searchIdx === search.length) {
    // Calculate score based on how "spread out" the match is
    const spread = target.length - search.length
    return Math.max(0.3, 0.6 - spread * 0.05)
  }

  // Calculate character-based similarity with position awareness
  // This helps with typos like "unaktive" vs "unactive" (k vs c)
  let matchingChars = 0
  const maxLength = Math.max(search.length, target.length)

  // Count matching characters in similar positions (allows for some position shift)
  for (let i = 0; i < search.length; i++) {
    const char = search[i]
    // Check exact position
    if (target[i] === char) {
      matchingChars += 1
    } else {
      // Check nearby positions (within 2 characters) for typos
      const checkRange = Math.min(2, target.length - i)
      let found = false
      for (
        let j = Math.max(0, i - 1);
        j <= Math.min(target.length - 1, i + checkRange);
        j++
      ) {
        if (target[j] === char && Math.abs(i - j) <= 2) {
          matchingChars += 0.7 // Partial credit for nearby match
          found = true
          break
        }
      }
      // If not found nearby, check if character exists anywhere (less weight)
      if (!found && target.includes(char)) {
        matchingChars += 0.3
      }
    }
  }

  // Also check reverse: how many target chars match search
  // This helps when search is shorter than target
  let reverseMatches = 0
  for (let i = 0; i < target.length; i++) {
    const char = target[i]
    if (search.includes(char)) {
      reverseMatches++
    }
  }

  // Combine forward and reverse matching
  const forwardSimilarity = matchingChars / search.length
  const reverseSimilarity = reverseMatches / target.length
  const combinedSimilarity = (forwardSimilarity + reverseSimilarity) / 2

  return combinedSimilarity * 0.4
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
