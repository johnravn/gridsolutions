import { describe, expect, it } from 'vitest'
import {
  monthlyChartDomains,
  syncZeroAlignedDomains,
} from './syncZeroAlignedDomains'

function zeroFraction([lo, hi]: [number, number]): number {
  return (0 - lo) / (hi - lo)
}

describe('syncZeroAlignedDomains', () => {
  it('aligns zeros when money goes negative and jobs stay non-negative', () => {
    const { a: money, b: jobs } = syncZeroAlignedDomains(
      -65_000,
      130_000,
      0,
      25,
    )
    expect(zeroFraction(money)).toBeCloseTo(zeroFraction(jobs), 8)
    expect(money[0]).toBeLessThanOrEqual(0)
    expect(money[1]).toBeGreaterThanOrEqual(130_000)
    expect(jobs[0]).toBeLessThan(0)
    expect(jobs[1]).toBe(25)
  })

  it('keeps zeros aligned when both sides are non-negative', () => {
    const { a, b } = syncZeroAlignedDomains(0, 100, 0, 10)
    expect(zeroFraction(a)).toBeCloseTo(0, 8)
    expect(zeroFraction(b)).toBeCloseTo(0, 8)
    expect(a).toEqual([0, 100])
    expect(b).toEqual([0, 10])
  })

  it('handles empty / zero spans without NaN', () => {
    const { a, b } = syncZeroAlignedDomains(0, 0, 0, 0)
    expect(Number.isFinite(a[0])).toBe(true)
    expect(Number.isFinite(a[1])).toBe(true)
    expect(Number.isFinite(b[0])).toBe(true)
    expect(Number.isFinite(b[1])).toBe(true)
    expect(zeroFraction(a)).toBeCloseTo(zeroFraction(b), 8)
  })
})

describe('monthlyChartDomains', () => {
  it('puts jobs 0 at the same plot fraction as money 0', () => {
    const { money, jobs } = monthlyChartDomains([
      { income: 100_000, expenses: 40_000, profit: 60_000, job_count: 8 },
      { income: 20_000, expenses: 85_000, profit: -65_000, job_count: 0 },
      { income: 130_000, expenses: 50_000, profit: 80_000, job_count: 12 },
    ])
    expect(zeroFraction(money)).toBeCloseTo(zeroFraction(jobs), 8)
    expect(jobs[0]).toBeLessThan(0)
  })
})
