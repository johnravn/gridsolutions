import { describe, expect, it } from 'vitest'
import {
  formatHoursBetween,
  formatHoursInput,
  hoursFromRangeOrDefault,
  hoursToRange,
  isValidLoggedHours,
  looksLikeHoursOnlyEntry,
  parseHoursInput,
  rangeToHours,
} from '@features/logging/lib/timeEntryHours'

describe('parseHoursInput', () => {
  it('parses decimal hours and comma decimals', () => {
    expect(parseHoursInput('7.5')).toBe(7.5)
    expect(parseHoursInput('7,5')).toBe(7.5)
    expect(parseHoursInput(' 8 ')).toBe(8)
  })

  it('returns null for empty or invalid input', () => {
    expect(parseHoursInput('')).toBeNull()
    expect(parseHoursInput('abc')).toBeNull()
  })
})

describe('isValidLoggedHours', () => {
  it('accepts hours greater than 0 up to 24', () => {
    expect(isValidLoggedHours(0.25)).toBe(true)
    expect(isValidLoggedHours(24)).toBe(true)
    expect(isValidLoggedHours(0)).toBe(false)
    expect(isValidLoggedHours(24.01)).toBe(false)
    expect(isValidLoggedHours(null)).toBe(false)
  })
})

describe('hoursToRange and rangeToHours', () => {
  it('stores hours from local midnight', () => {
    const dateIso = new Date(2026, 5, 15, 14, 30).toISOString()
    const range = hoursToRange(dateIso, 8)
    const start = new Date(range.startAt)
    const end = new Date(range.endAt)

    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(5)
    expect(start.getDate()).toBe(15)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(end.getTime() - start.getTime()).toBe(8 * 60 * 60 * 1000)
    expect(rangeToHours(range.startAt, range.endAt)).toBe(8)
  })

  it('round-trips fractional hours', () => {
    const dateIso = new Date(2026, 5, 15).toISOString()
    const range = hoursToRange(dateIso, 7.5)
    expect(rangeToHours(range.startAt, range.endAt)).toBe(7.5)
  })
})

describe('looksLikeHoursOnlyEntry', () => {
  it('detects midnight-start duration entries', () => {
    const range = hoursToRange(new Date(2026, 5, 15).toISOString(), 7.5)
    expect(looksLikeHoursOnlyEntry(range.startAt, range.endAt)).toBe(true)
  })

  it('rejects timed start-to-end entries', () => {
    const start = new Date(2026, 5, 15, 8, 0).toISOString()
    const end = new Date(2026, 5, 15, 16, 0).toISOString()
    expect(looksLikeHoursOnlyEntry(start, end)).toBe(false)
  })
})

describe('format helpers', () => {
  it('formats hours input without extra zeros', () => {
    expect(formatHoursInput(8)).toBe('8')
    expect(formatHoursInput(7.5)).toBe('7.5')
  })

  it('formats duration between two timestamps', () => {
    const start = new Date(2026, 5, 15, 8, 0).toISOString()
    const end = new Date(2026, 5, 15, 10, 30).toISOString()
    expect(formatHoursBetween(start, end)).toBe('2.50 hours')
    expect(formatHoursBetween('', end)).toBe('--')
  })

  it('falls back to 1 hour when the range is empty', () => {
    expect(hoursFromRangeOrDefault('', '')).toBe(1)
  })

  it('caps long ranges at 24 hours', () => {
    const start = new Date(2026, 5, 15, 0, 0).toISOString()
    const end = new Date(2026, 5, 17, 0, 0).toISOString()
    expect(hoursFromRangeOrDefault(start, end)).toBe(24)
  })
})
