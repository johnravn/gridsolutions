import type { DailyQuote } from '../data/quotes'

function hashStringToInt(input: string): number {
  // Simple deterministic hash (non-crypto) for stable day-based picking.
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function pickQuoteForDate({
  dateKey,
  quotes,
}: {
  dateKey: string
  quotes: Array<DailyQuote>
}): DailyQuote | null {
  if (quotes.length === 0) return null
  const idx = hashStringToInt(dateKey) % quotes.length
  return quotes[idx] ?? null
}

export type DailyInspirationType = 'quote' | 'bibleverse'

export function normalizeDailyInspirationType(
  value: unknown,
): DailyInspirationType {
  return value === 'bibleverse' ? 'bibleverse' : 'quote'
}

