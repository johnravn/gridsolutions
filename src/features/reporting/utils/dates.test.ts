import { describe, expect, it } from 'vitest'
import {
  compareMonthYear,
  currentMonthYear,
  dateRangeFromMonthYears,
  reportingYearOptions,
} from './dates'

describe('currentMonthYear', () => {
  it('uses 1-based months', () => {
    expect(currentMonthYear(new Date(2026, 0, 15))).toEqual({
      year: 2026,
      month: 1,
    })
    expect(currentMonthYear(new Date(2026, 10, 1))).toEqual({
      year: 2026,
      month: 11,
    })
  })
})

describe('dateRangeFromMonthYears', () => {
  it('returns a single month when from and to match', () => {
    expect(
      dateRangeFromMonthYears(
        { year: 2026, month: 3 },
        { year: 2026, month: 3 },
      ),
    ).toEqual({ fromDate: '2026-03-01', toDate: '2026-03-31' })
  })

  it('returns an inclusive multi-month period', () => {
    expect(
      dateRangeFromMonthYears(
        { year: 2026, month: 1 },
        { year: 2026, month: 3 },
      ),
    ).toEqual({ fromDate: '2026-01-01', toDate: '2026-03-31' })
  })

  it('normalizes reversed endpoints', () => {
    expect(
      dateRangeFromMonthYears(
        { year: 2026, month: 6 },
        { year: 2026, month: 2 },
      ),
    ).toEqual({ fromDate: '2026-02-01', toDate: '2026-06-30' })
  })

  it('handles February in a leap year', () => {
    expect(
      dateRangeFromMonthYears(
        { year: 2024, month: 2 },
        { year: 2024, month: 2 },
      ),
    ).toEqual({ fromDate: '2024-02-01', toDate: '2024-02-29' })
  })
})

describe('compareMonthYear', () => {
  it('orders by year then month', () => {
    expect(
      compareMonthYear({ year: 2025, month: 12 }, { year: 2026, month: 1 }),
    ).toBeLessThan(0)
    expect(
      compareMonthYear({ year: 2026, month: 5 }, { year: 2026, month: 5 }),
    ).toBe(0)
  })
})

describe('reportingYearOptions', () => {
  it('lists future years first through past years', () => {
    expect(reportingYearOptions(new Date(2026, 0, 1), 2, 1)).toEqual([
      2027, 2026, 2025, 2024,
    ])
  })
})
