import { describe, expect, it } from 'vitest'
import {
  canVerifyJobAccounting,
  getSeriesAccountingStatus,
} from './seriesAccountingStatus'
import type { JobStatus, RecurringJobAccountingEntry } from '../types'

function job(id: string, archived = false) {
  return { id, archived }
}

function entry(
  jobId: string,
  overrides: Partial<RecurringJobAccountingEntry> = {},
): RecurringJobAccountingEntry {
  return {
    job_id: jobId,
    job_title: jobId,
    jobnr: null,
    status: 'completed' as JobStatus,
    archived: false,
    start_at: null,
    end_at: null,
    money_verified_at: null,
    project_lead_user_id: null,
    income_total: 0,
    expense_total: 0,
    item_count: 0,
    ...overrides,
  }
}

describe('getSeriesAccountingStatus', () => {
  it('counts verified vs unverified active jobs and ledger totals', () => {
    const result = getSeriesAccountingStatus(
      [job('a'), job('b'), job('c'), job('d', true)],
      [
        entry('a', {
          money_verified_at: '2026-01-01T00:00:00Z',
          income_total: 1000,
          expense_total: 200,
          item_count: 2,
        }),
        entry('b', {
          income_total: 500,
          expense_total: 100,
          item_count: 1,
        }),
        entry('c'),
        entry('d', {
          money_verified_at: '2026-01-01T00:00:00Z',
          income_total: 999,
          item_count: 5,
        }),
      ],
    )

    expect(result.activeJobs).toHaveLength(3)
    expect(result.verifiedCount).toBe(1)
    expect(result.unverifiedCount).toBe(2)
    expect(result.withLedgerCount).toBe(2)
    expect(result.incomeTotal).toBe(1500)
    expect(result.expenseTotal).toBe(300)
    expect(result.netTotal).toBe(1200)
    expect(result.seriesFullyVerified).toBe(false)
  })

  it('marks a fully verified series', () => {
    const result = getSeriesAccountingStatus(
      [job('a'), job('b')],
      [
        entry('a', { money_verified_at: '2026-01-01T00:00:00Z' }),
        entry('b', { money_verified_at: '2026-01-02T00:00:00Z' }),
      ],
    )
    expect(result.seriesFullyVerified).toBe(true)
    expect(result.unverifiedCount).toBe(0)
  })

  it('marks an empty series as not fully verified', () => {
    const result = getSeriesAccountingStatus([], [])
    expect(result.seriesFullyVerified).toBe(false)
    expect(result.activeJobs).toHaveLength(0)
  })
})

describe('canVerifyJobAccounting', () => {
  it('allows owners, super users, global superusers, and the project lead', () => {
    expect(
      canVerifyJobAccounting({
        userId: 'u1',
        isGlobalSuperuser: false,
        companyRole: 'owner',
        projectLeadUserId: 'other',
      }),
    ).toBe(true)
    expect(
      canVerifyJobAccounting({
        userId: 'u1',
        isGlobalSuperuser: true,
        companyRole: 'freelancer',
        projectLeadUserId: null,
      }),
    ).toBe(true)
    expect(
      canVerifyJobAccounting({
        userId: 'u1',
        isGlobalSuperuser: false,
        companyRole: 'user',
        projectLeadUserId: 'u1',
      }),
    ).toBe(true)
    expect(
      canVerifyJobAccounting({
        userId: 'u1',
        isGlobalSuperuser: false,
        companyRole: 'user',
        projectLeadUserId: 'other',
      }),
    ).toBe(false)
    expect(
      canVerifyJobAccounting({
        userId: null,
        isGlobalSuperuser: true,
        companyRole: 'owner',
        projectLeadUserId: 'u1',
      }),
    ).toBe(false)
  })
})
