import { describe, expect, it } from 'vitest'
import {
  formatPeriodLabel,
  isMonthInRange,
  normalizeMonthYearRange,
  yearRangeToMonthYears,
} from './periodPicker'

describe('normalizeMonthYearRange', () => {
  it('orders endpoints', () => {
    expect(
      normalizeMonthYearRange(
        { year: 2026, month: 3 },
        { year: 2025, month: 11 },
      ),
    ).toEqual({
      from: { year: 2025, month: 11 },
      to: { year: 2026, month: 3 },
    })
  })
})

describe('formatPeriodLabel', () => {
  it('formats a single month', () => {
    const label = formatPeriodLabel(
      { year: 2026, month: 11 },
      { year: 2026, month: 11 },
      'month',
    )
    expect(label).toMatch(/2026/)
  })

  it('formats a month range across years', () => {
    const label = formatPeriodLabel(
      { year: 2025, month: 11 },
      { year: 2026, month: 3 },
      'month',
    )
    expect(label).toContain('–')
    expect(label).toMatch(/2025/)
    expect(label).toMatch(/2026/)
  })

  it('formats year mode', () => {
    expect(
      formatPeriodLabel(
        { year: 2024, month: 1 },
        { year: 2026, month: 12 },
        'year',
      ),
    ).toBe('2024 – 2026')
    expect(
      formatPeriodLabel(
        { year: 2026, month: 1 },
        { year: 2026, month: 12 },
        'year',
      ),
    ).toBe('2026')
  })
})

describe('yearRangeToMonthYears', () => {
  it('expands to Jan–Dec inclusive', () => {
    expect(yearRangeToMonthYears(2026, 2024)).toEqual({
      from: { year: 2024, month: 1 },
      to: { year: 2026, month: 12 },
    })
  })
})

describe('isMonthInRange', () => {
  it('includes endpoints', () => {
    expect(
      isMonthInRange(
        { year: 2025, month: 12 },
        { year: 2025, month: 11 },
        { year: 2026, month: 3 },
      ),
    ).toBe(true)
    expect(
      isMonthInRange(
        { year: 2025, month: 10 },
        { year: 2025, month: 11 },
        { year: 2026, month: 3 },
      ),
    ).toBe(false)
  })
})
