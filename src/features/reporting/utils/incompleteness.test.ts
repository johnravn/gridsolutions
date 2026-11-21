import { describe, expect, it } from 'vitest'
import {
  filterAccountingUnverifiedJobs,
  filterIncompleteMoneyJobs,
  isAccountingUnverifiedJob,
  isMoneyIncompleteJob,
  isMoneyReviewStatus,
} from './incompleteness'

describe('isMoneyReviewStatus', () => {
  it('accepts completed/invoiced/paid', () => {
    expect(isMoneyReviewStatus('completed')).toBe(true)
    expect(isMoneyReviewStatus('invoiced')).toBe(true)
    expect(isMoneyReviewStatus('paid')).toBe(true)
  })

  it('rejects other statuses', () => {
    expect(isMoneyReviewStatus('confirmed')).toBe(false)
    expect(isMoneyReviewStatus(null)).toBe(false)
  })
})

describe('isMoneyIncompleteJob', () => {
  it('flags completed jobs with empty ledger or no income', () => {
    expect(
      isMoneyIncompleteJob({ status: 'completed', income: 0, itemCount: 0 }),
    ).toBe(true)
    expect(
      isMoneyIncompleteJob({ status: 'paid', income: 0, itemCount: 2 }),
    ).toBe(true)
    expect(
      isMoneyIncompleteJob({
        status: 'invoiced',
        income: 100,
        itemCount: 1,
      }),
    ).toBe(false)
  })

  it('ignores active jobs even with empty money', () => {
    expect(
      isMoneyIncompleteJob({ status: 'confirmed', income: 0, itemCount: 0 }),
    ).toBe(false)
  })
})

describe('filterIncompleteMoneyJobs', () => {
  it('keeps only incomplete rows', () => {
    const rows = [
      { money_incomplete: true, id: 'a' },
      { money_incomplete: false, id: 'b' },
    ]
    expect(filterIncompleteMoneyJobs(rows).map((r) => r.id)).toEqual(['a'])
  })
})

describe('isAccountingUnverifiedJob', () => {
  it('matches paid/invoiced without verification', () => {
    expect(
      isAccountingUnverifiedJob({ status: 'paid', money_verified: false }),
    ).toBe(true)
    expect(
      isAccountingUnverifiedJob({ status: 'invoiced', money_verified: false }),
    ).toBe(true)
    expect(
      isAccountingUnverifiedJob({ status: 'paid', money_verified: true }),
    ).toBe(false)
    expect(
      isAccountingUnverifiedJob({
        status: 'completed',
        money_verified: false,
      }),
    ).toBe(false)
  })
})

describe('filterAccountingUnverifiedJobs', () => {
  it('keeps only paid/invoiced unverified rows', () => {
    const rows = [
      { id: 'a', status: 'paid', money_verified: false },
      { id: 'b', status: 'invoiced', money_verified: true },
      { id: 'c', status: 'completed', money_verified: false },
    ]
    expect(filterAccountingUnverifiedJobs(rows).map((r) => r.id)).toEqual([
      'a',
    ])
  })
})
