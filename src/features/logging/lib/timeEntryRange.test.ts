import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildLockedMonthSet,
  formatLoggingDate,
  formatMonthInput,
  getMonthOptions,
  getRange,
  isRangeOverlappingLockedPeriod,
  shiftRangeToMonth,
  toMonthKey,
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

describe('toMonthKey', () => {
  it('reads YYYY-MM from ISO strings', () => {
    expect(toMonthKey('2026-06-15T12:00:00.000Z')).toBe('2026-06')
  })
})

describe('buildLockedMonthSet', () => {
  it('collects only locked period months', () => {
    expect(
      [
        ...buildLockedMonthSet([
          { period_start: '2026-05-01', is_locked: false },
          { period_start: '2026-06-01', is_locked: true },
          { period_start: '2026-07-01', is_locked: true },
        ]),
      ].sort(),
    ).toEqual(['2026-06', '2026-07'])
  })
})

describe('isRangeOverlappingLockedPeriod', () => {
  it('returns false when no locked months', () => {
    expect(
      isRangeOverlappingLockedPeriod({
        startAt: new Date(2026, 5, 10, 9).toISOString(),
        endAt: new Date(2026, 5, 10, 17).toISOString(),
        lockedMonthSet: new Set(),
      }),
    ).toBe(false)
  })

  it('detects overlap when the start month is locked', () => {
    expect(
      isRangeOverlappingLockedPeriod({
        startAt: new Date(2026, 5, 10, 9).toISOString(),
        endAt: new Date(2026, 5, 10, 17).toISOString(),
        lockedMonthSet: new Set(['2026-06']),
      }),
    ).toBe(true)
  })

  it('detects overlap across a multi-month range', () => {
    expect(
      isRangeOverlappingLockedPeriod({
        startAt: new Date(2026, 4, 28, 9).toISOString(),
        endAt: new Date(2026, 6, 2, 17).toISOString(),
        lockedMonthSet: new Set(['2026-06']),
      }),
    ).toBe(true)
  })
})

describe('shiftRangeToMonth', () => {
  it('returns null when already in the target month', () => {
    const startAt = new Date(2026, 5, 10, 9).toISOString()
    const endAt = new Date(2026, 5, 10, 17).toISOString()
    expect(
      shiftRangeToMonth({ startAt, endAt, monthKey: '2026-06' }),
    ).toBeNull()
  })

  it('preserves duration when moving to another month', () => {
    const startAt = new Date(2026, 5, 10, 9).toISOString()
    const endAt = new Date(2026, 5, 10, 17).toISOString()
    const shifted = shiftRangeToMonth({
      startAt,
      endAt,
      monthKey: '2026-07',
    })
    expect(shifted).not.toBeNull()
    expect(toMonthKey(shifted!.startAt)).toBe('2026-07')
    expect(
      new Date(shifted!.endAt).getTime() - new Date(shifted!.startAt).getTime(),
    ).toBe(8 * 60 * 60 * 1000)
  })
})
