import { describe, expect, it } from 'vitest'
import {
  addLocalCalendarDays,
  formatLocalYmd,
  formatVATInput,
  fmtVAT,
  fuzzyMatch,
  fuzzyMatchScore,
  fuzzySearch,
  getInitials,
  getInitialsFromNameOrEmail,
  makeWordPresentable,
} from './generalFunctions'

describe('formatLocalYmd', () => {
  it('formats local calendar date without UTC shift', () => {
    const date = new Date(2026, 5, 26)
    expect(formatLocalYmd(date)).toBe('2026-06-26')
  })
})

describe('addLocalCalendarDays', () => {
  it('adds calendar days in local time', () => {
    const date = new Date(2026, 5, 26)
    const result = addLocalCalendarDays(date, 3)
    expect(formatLocalYmd(result)).toBe('2026-06-29')
  })
})

describe('fmtVAT', () => {
  it('formats nine-digit Norwegian VAT numbers', () => {
    expect(fmtVAT('123456789')).toBe('123 456 789')
  })

  it('returns em dash for empty input', () => {
    expect(fmtVAT('')).toBe('—')
    expect(fmtVAT(null)).toBe('—')
  })
})

describe('formatVATInput', () => {
  it('strips non-digits and groups input', () => {
    expect(formatVATInput('1234')).toBe('123 4')
    expect(formatVATInput('1234567890')).toBe('123 456 789')
  })
})

describe('fuzzy matching', () => {
  it('scores exact and partial matches', () => {
    expect(fuzzyMatchScore('mic', 'microphone')).toBeGreaterThan(0.7)
    expect(fuzzyMatch('mic', 'microphone')).toBe(true)
    expect(fuzzyMatch('zzz', 'microphone')).toBe(false)
  })

  it('filters and sorts items by score', () => {
    const items = [
      { name: 'Camera' },
      { name: 'Microphone' },
      { name: 'Mixer' },
    ]
    const result = fuzzySearch(items, 'mic', [(item) => item.name])
    expect(result.map((item) => item.name)).toEqual(['Microphone'])
  })
})

describe('getInitials', () => {
  it('uses first and last word for multi-word names', () => {
    expect(getInitials('John Ravndal')).toBe('JR')
  })

  it('uses first two characters for single token', () => {
    expect(getInitials('john@example.com')).toBe('JO')
  })

  it('returns question mark for empty input', () => {
    expect(getInitials('')).toBe('?')
  })
})

describe('getInitialsFromNameOrEmail', () => {
  it('prefers name over email', () => {
    expect(getInitialsFromNameOrEmail('Jane Doe', 'jane@example.com')).toBe(
      'JD',
    )
    expect(getInitialsFromNameOrEmail(null, 'jane@example.com')).toBe('JA')
  })
})

describe('makeWordPresentable', () => {
  it('capitalizes and replaces separators', () => {
    expect(makeWordPresentable('in_progress')).toBe('In progress')
  })
})
