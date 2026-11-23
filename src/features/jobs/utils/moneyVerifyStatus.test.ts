import { describe, expect, it } from 'vitest'
import {
  JOB_MONEY_VERIFY_STATUSES,
  isJobStatusEligibleForMoneyVerify,
} from './moneyVerifyStatus'

describe('isJobStatusEligibleForMoneyVerify', () => {
  it('allows invoiced, paid, and canceled', () => {
    for (const status of JOB_MONEY_VERIFY_STATUSES) {
      expect(isJobStatusEligibleForMoneyVerify(status)).toBe(true)
    }
  })

  it('rejects earlier workflow statuses and empty values', () => {
    expect(isJobStatusEligibleForMoneyVerify('draft')).toBe(false)
    expect(isJobStatusEligibleForMoneyVerify('completed')).toBe(false)
    expect(isJobStatusEligibleForMoneyVerify('in_progress')).toBe(false)
    expect(isJobStatusEligibleForMoneyVerify(null)).toBe(false)
    expect(isJobStatusEligibleForMoneyVerify(undefined)).toBe(false)
    expect(isJobStatusEligibleForMoneyVerify('')).toBe(false)
  })
})
