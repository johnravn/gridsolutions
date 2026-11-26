import { describe, expect, it } from 'vitest'
import {
  isJobStatusEligibleForMoneyVerify,
  isSeriesEligibleForMoneyVerify,
} from './moneyVerifyStatus'

describe('isJobStatusEligibleForMoneyVerify', () => {
  it('allows invoiced, paid, canceled', () => {
    expect(isJobStatusEligibleForMoneyVerify('invoiced')).toBe(true)
    expect(isJobStatusEligibleForMoneyVerify('paid')).toBe(true)
    expect(isJobStatusEligibleForMoneyVerify('canceled')).toBe(true)
  })

  it('rejects other statuses', () => {
    expect(isJobStatusEligibleForMoneyVerify('completed')).toBe(false)
    expect(isJobStatusEligibleForMoneyVerify(null)).toBe(false)
  })
})

describe('isSeriesEligibleForMoneyVerify', () => {
  it('is true when any child is eligible', () => {
    expect(
      isSeriesEligibleForMoneyVerify(['completed', 'invoiced', 'planned']),
    ).toBe(true)
  })

  it('is false when no child is eligible', () => {
    expect(isSeriesEligibleForMoneyVerify(['completed', 'planned'])).toBe(false)
    expect(isSeriesEligibleForMoneyVerify([])).toBe(false)
  })
})
