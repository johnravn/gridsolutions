import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatLoggingDate,
  formatMonthInput,
  getMonthOptions,
  getRange,
} from '@features/logging/lib/timeEntryRange'
import {
  LOGGING_FIXTURE_DATES,
  LOGGING_MONTH_INPUTS,
} from '@test/fixtures/logging'

describe('formatLoggingDate', () => {
  it('formats a valid ISO date as "day. mon year"', () => {
    expect(formatLoggingDate(LOGGING_FIXTURE_DATES.midJune2026)).toBe(
      '15. jun 2026',
    )
    expect(formatLoggingDate(LOGGING_FIXTURE_DATES.january2026)).toBe(
      '10. jan 2026',
    )
  })

  it('returns the input unchanged for invalid dates', () => {
    expect(formatLoggingDate(LOGGING_FIXTURE_DATES.invalid)).toBe('not-a-date')
  })
})

describe('formatMonthInput', () => {
  it('formats a date as YYYY-MM', () => {
    expect(formatMonthInput(new Date('2026-06-15T12:00:00.000Z'))).toBe(
      '2026-06',
    )
    expect(formatMonthInput(new Date('2026-01-10T08:30:00.000Z'))).toBe(
      '2026-01',
    )
  })
})

describe('getMonthOptions', () => {
  it('returns 12 months for the given year', () => {
    const options = getMonthOptions(2026)

    expect(options).toHaveLength(12)
    expect(options[0]).toEqual({
      label: 'jan',
      value: '2026-01',
      monthIndex: 0,
    })
    expect(options[11]).toEqual({
      label: 'des',
      value: '2026-12',
      monthIndex: 11,
    })
  })
})

describe('getRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the selected month range', () => {
    const range = getRange('month', LOGGING_MONTH_INPUTS.valid)

    expect(range.label).toBe('jun 2026')
    expect(range.from).toBe(new Date(2026, 5, 1).toISOString())
    expect(range.to).toBe(new Date(2026, 6, 1).toISOString())
  })

  it('defaults to the current month when no month is provided', () => {
    const range = getRange('month')

    expect(range.label).toBe('jun 2026')
    expect(range.from).toBe(new Date(2026, 5, 1).toISOString())
    expect(range.to).toBe(new Date(2026, 6, 1).toISOString())
  })

  it('falls back to the current month for invalid month input', () => {
    const range = getRange('month', LOGGING_MONTH_INPUTS.invalid)

    expect(range.label).toBe('jun 2026')
    expect(range.from).toBe(new Date(2026, 5, 1).toISOString())
    expect(range.to).toBe(new Date(2026, 6, 1).toISOString())
  })

  it('falls back to the current month for malformed month input', () => {
    const range = getRange('month', LOGGING_MONTH_INPUTS.malformed)

    expect(range.label).toBe('jun 2026')
  })

  it('returns the current year range', () => {
    const range = getRange('year')

    expect(range.label).toBe('2026')
    expect(range.from).toBe(new Date(2026, 0, 1).toISOString())
    expect(range.to).toBe(new Date(2027, 0, 1).toISOString())
  })

  it('returns last year range', () => {
    const range = getRange('last-year')

    expect(range.label).toBe('2025')
    expect(range.from).toBe(new Date(2025, 0, 1).toISOString())
    expect(range.to).toBe(new Date(2026, 0, 1).toISOString())
  })
})
