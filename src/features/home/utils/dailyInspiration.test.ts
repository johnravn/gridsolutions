import { describe, expect, it } from 'vitest'
import {
  normalizeDailyInspirationType,
  pickQuoteForDate,
} from './dailyInspiration'

describe('pickQuoteForDate', () => {
  const quotes = [
    { quote: 'Quote A', author: 'Author A' },
    { quote: 'Quote B', author: 'Author B' },
    { quote: 'Quote C', author: 'Author C' },
  ]

  it('returns null for empty quotes', () => {
    expect(pickQuoteForDate({ dateKey: '2026-06-15', quotes: [] })).toBeNull()
  })

  it('returns deterministic quote for same date key', () => {
    const a = pickQuoteForDate({ dateKey: '2026-06-15', quotes })
    const b = pickQuoteForDate({ dateKey: '2026-06-15', quotes })
    expect(a).toEqual(b)
    expect(quotes).toContainEqual(a)
  })

  it('may return different quotes for different dates', () => {
    const a = pickQuoteForDate({ dateKey: '2026-06-15', quotes })
    const b = pickQuoteForDate({ dateKey: '2026-01-01', quotes })
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
  })
})

describe('normalizeDailyInspirationType', () => {
  it('returns bibleverse when value is bibleverse', () => {
    expect(normalizeDailyInspirationType('bibleverse')).toBe('bibleverse')
  })

  it('defaults to quote for other values', () => {
    expect(normalizeDailyInspirationType('quote')).toBe('quote')
    expect(normalizeDailyInspirationType(undefined)).toBe('quote')
    expect(normalizeDailyInspirationType('other')).toBe('quote')
  })
})
