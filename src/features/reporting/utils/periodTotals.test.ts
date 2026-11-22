import { describe, expect, it } from 'vitest'
import { aggregatePeriodTotals, periodTotalsChartDomains } from './periodTotals'

function zeroFraction([lo, hi]: [number, number]): number {
  return (0 - lo) / (hi - lo)
}

describe('aggregatePeriodTotals', () => {
  it('sums money and counts jobs', () => {
    expect(
      aggregatePeriodTotals([
        { income: 1000, expenses: 400, profit: 600 },
        { income: 500, expenses: 700, profit: -200 },
      ]),
    ).toEqual({
      income: 1500,
      expenses: 1100,
      profit: 400,
      job_count: 2,
    })
  })

  it('returns zeros for an empty set', () => {
    expect(aggregatePeriodTotals([])).toEqual({
      income: 0,
      expenses: 0,
      profit: 0,
      job_count: 0,
    })
  })
})

describe('periodTotalsChartDomains', () => {
  it('aligns money and jobs zeros for honest dual-axis bars', () => {
    const { money, jobs } = periodTotalsChartDomains({
      expenses: 85_000,
      income: 40_000,
      profit: -45_000,
      job_count: 7,
    })
    expect(zeroFraction(money)).toBeCloseTo(zeroFraction(jobs), 8)
    expect(money[0]).toBeLessThanOrEqual(-45_000)
    expect(jobs[1]).toBeGreaterThanOrEqual(7)
  })
})
