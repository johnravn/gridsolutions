import { describe, expect, it } from 'vitest'
import {
  computeLoggingExpenseAmount,
  loggingExpenseDescription,
  loggingExpenseSourceId,
} from './loggingExpense'

describe('loggingExpenseSourceId', () => {
  it('prefixes the entry id', () => {
    expect(loggingExpenseSourceId('abc')).toBe('logging-abc')
  })
})

describe('loggingExpenseDescription', () => {
  it('includes title and hours when title is set', () => {
    expect(
      loggingExpenseDescription({
        userName: 'Ada',
        title: 'Rig',
        hoursLabel: '3h',
      }),
    ).toBe('Ada: Rig (3h)')
  })

  it('falls back without title', () => {
    expect(
      loggingExpenseDescription({
        userName: 'Ada',
        title: '  ',
        hoursLabel: '2h 30m',
      }),
    ).toBe('Ada: logging 2h 30m')
  })
})

describe('computeLoggingExpenseAmount', () => {
  const start = '2026-03-01T08:00:00.000Z'
  const end = '2026-03-01T12:00:00.000Z' // 4h

  it('uses freelancer personal hourly rate × hours', () => {
    expect(
      computeLoggingExpenseAmount({
        startAt: start,
        endAt: end,
        userRate: { role: 'freelancer', rate: 500, rate_type: 'hourly' },
        companyRates: null,
      }),
    ).toBe(2000)
  })

  it('uses company employee hourly rate when role is employee', () => {
    expect(
      computeLoggingExpenseAmount({
        startAt: start,
        endAt: end,
        userRate: { role: 'employee', rate: null, rate_type: null },
        companyRates: {
          employee_hourly_rate: 750,
          employee_daily_rate: null,
          owner_hourly_rate: null,
          owner_daily_rate: null,
        },
      }),
    ).toBe(3000)
  })

  it('returns null when no rate is available', () => {
    expect(
      computeLoggingExpenseAmount({
        startAt: start,
        endAt: end,
        userRate: { role: 'freelancer', rate: null, rate_type: null },
        companyRates: null,
      }),
    ).toBeNull()
  })
})
