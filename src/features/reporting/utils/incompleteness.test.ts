import { describe, expect, it } from 'vitest'
import {
  filterIncompleteMoneyJobs,
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
