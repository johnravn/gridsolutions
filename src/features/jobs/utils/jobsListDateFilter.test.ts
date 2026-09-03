import { describe, expect, it } from 'vitest'
import {
  jobsListDatePresetRange,
  jobsListYearOptions,
  jobsListYearRange,
  resolveJobsDatePreset,
  resolveJobsListYear,
} from './jobsListDateFilter'

describe('jobsListDatePresetRange', () => {
  const wednesday = new Date(2026, 8, 2, 15, 0, 0)

  it('uses Monday–Sunday for this week', () => {
    expect(jobsListDatePresetRange('this_week', wednesday)).toEqual({
      dateFrom: '2026-08-31',
      dateTo: '2026-09-06',
    })
  })

  it('uses next week through the week after for next 2 weeks', () => {
    expect(jobsListDatePresetRange('next_2_weeks', wednesday)).toEqual({
      dateFrom: '2026-09-07',
      dateTo: '2026-09-20',
    })
  })

  it('uses the calendar month', () => {
    expect(jobsListDatePresetRange('this_month', wednesday)).toEqual({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    })
  })

  it('uses today with no end for upcoming', () => {
    expect(jobsListDatePresetRange('upcoming', wednesday)).toEqual({
      dateFrom: '2026-09-02',
      dateTo: '',
    })
  })

  it('uses yesterday with no start for past', () => {
    expect(jobsListDatePresetRange('past', wednesday)).toEqual({
      dateFrom: '',
      dateTo: '2026-09-01',
    })
  })
})

describe('jobsListYearRange', () => {
  it('covers the full calendar year', () => {
    expect(jobsListYearRange(2024)).toEqual({
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    })
  })
})

describe('resolveJobsListYear', () => {
  it('returns the year for a full-year range', () => {
    expect(resolveJobsListYear('2025-01-01', '2025-12-31')).toBe(2025)
  })

  it('returns null for partial ranges', () => {
    expect(resolveJobsListYear('2025-01-01', '2025-01-31')).toBeNull()
    expect(resolveJobsListYear('', '2025-12-31')).toBeNull()
  })
})

describe('jobsListYearOptions', () => {
  it('includes next year through 20 years back', () => {
    const years = jobsListYearOptions(new Date(2026, 8, 2))
    expect(years[0]).toBe(2027)
    expect(years.at(-1)).toBe(2006)
    expect(years).toContain(2026)
  })
})

describe('resolveJobsDatePreset', () => {
  const wednesday = new Date(2026, 8, 2, 15, 0, 0)

  it('resolves empty dates as all', () => {
    expect(resolveJobsDatePreset('', '', wednesday)).toBe('all')
  })

  it('resolves matching presets', () => {
    expect(resolveJobsDatePreset('2026-08-31', '2026-09-06', wednesday)).toBe(
      'this_week',
    )
    expect(resolveJobsDatePreset('2026-09-02', '', wednesday)).toBe('upcoming')
    expect(resolveJobsDatePreset('', '2026-09-01', wednesday)).toBe('past')
  })

  it('resolves a full calendar year', () => {
    expect(resolveJobsDatePreset('2024-01-01', '2024-12-31', wednesday)).toBe(
      'year',
    )
  })

  it('falls back to custom', () => {
    expect(resolveJobsDatePreset('2026-01-01', '2026-01-02', wednesday)).toBe(
      'custom',
    )
  })
})
