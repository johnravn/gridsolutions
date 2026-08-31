import { describe, expect, it } from 'vitest'
import {
  addLocalCalendarDays,
  formatLocalYmd,
  formatVATInput,
  fmtVAT,
  fuzzyMatch,
  fuzzyMatchScore,
  fuzzySearch,
  getFuzzyMatchRanges,
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
    expect(result[0]?.name).toBe('Microphone')
    expect(result.map((item) => item.name)).not.toContain('Camera')
  })

  it('returns substring ranges for highlighting', () => {
    expect(getFuzzyMatchRanges('mic', 'Microphone')).toEqual([
      { start: 0, end: 3 },
    ])
  })

  it('matches compacted tokens so "1 ch" finds "1ch"', () => {
    expect(fuzzyMatchScore('1 ch', '1ch')).toBeGreaterThan(0.9)
    expect(fuzzyMatch('1 ch', '1ch', 0.25)).toBe(true)
    const result = fuzzySearch(
      [{ name: '2ch' }, { name: '1ch' }, { name: '12ch' }],
      '1 ch',
      [(item) => item.name],
      0.25,
    )
    expect(result[0]?.name).toBe('1ch')
    expect(result.map((item) => item.name)).toContain('12ch')
  })

  it('highlights compacted queries on names without spaces', () => {
    expect(getFuzzyMatchRanges('1 ch', '1ch')).toEqual([{ start: 0, end: 3 }])
  })

  it('highlights out-of-order tokens from Fuse match indices', () => {
    expect(getFuzzyMatchRanges('sm58 shure', 'Shure SM58')).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 10 },
    ])
    expect(getFuzzyMatchRanges('mro', 'Microphone')).toEqual([
      { start: 3, end: 5 },
    ])
  })

  it('matches a single-letter substitution like o vs a', () => {
    expect(fuzzyMatchScore('share', 'Shure')).toBeGreaterThanOrEqual(0.25)
    expect(fuzzyMatch('share', 'Shure SM58', 0.25)).toBe(true)
    expect(fuzzyMatch('yomaha', 'Yamaha', 0.25)).toBe(true)
    expect(fuzzyMatch('zzzzz', 'Shure SM58', 0.25)).toBe(false)

    const result = fuzzySearch(
      [{ name: 'Camera' }, { name: 'Shure SM58' }, { name: 'Mixer' }],
      'share',
      [(item) => item.name],
      0.25,
    )
    expect(result.map((item) => item.name)).toEqual(['Shure SM58'])
  })

  it('highlights the typo window for a substituted letter', () => {
    expect(getFuzzyMatchRanges('share', 'Shure SM58')).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 5 },
    ])
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
