import { describe, expect, it } from 'vitest'
import {
  deriveContaSyncStatus,
  summarizeContaSyncResults,
  type ContaSyncCompanyResult,
} from './contaCustomerSyncCron'

describe('deriveContaSyncStatus', () => {
  it('returns failed for top-level error', () => {
    expect(deriveContaSyncStatus([], 'config error')).toBe('failed')
  })

  it('returns success for empty results', () => {
    expect(deriveContaSyncStatus([])).toBe('success')
  })

  it('returns success when all companies sync cleanly', () => {
    const results: Array<ContaSyncCompanyResult> = [
      { companyId: 'a', updated: 2, created: 1, skipped: 0, errors: [] },
      { companyId: 'b', updated: 0, created: 0, skipped: 3, errors: [] },
    ]
    expect(deriveContaSyncStatus(results)).toBe('success')
  })

  it('returns partial when any company has errors', () => {
    const results: Array<ContaSyncCompanyResult> = [
      { companyId: 'a', updated: 2, created: 0, skipped: 0, errors: [] },
      {
        companyId: 'b',
        updated: 0,
        created: 0,
        skipped: 0,
        errors: ['Customer X: failed'],
      },
    ]
    expect(deriveContaSyncStatus(results)).toBe('partial')
  })

  it('returns partial when a company is skipped due to missing API key', () => {
    const results: Array<ContaSyncCompanyResult> = [
      {
        companyId: 'a',
        updated: 0,
        created: 0,
        skipped: 0,
        skippedReason: 'No active Conta API key for company',
        errors: [],
      },
    ]
    expect(deriveContaSyncStatus(results)).toBe('partial')
  })

  it('returns failed when every company failed with errors', () => {
    const results: Array<ContaSyncCompanyResult> = [
      {
        companyId: 'a',
        updated: 0,
        created: 0,
        skipped: 0,
        errors: ['RPC failed'],
      },
      {
        companyId: 'b',
        updated: 0,
        created: 0,
        skipped: 0,
        errors: ['Sync failed'],
      },
    ]
    expect(deriveContaSyncStatus(results)).toBe('failed')
  })
})

describe('summarizeContaSyncResults', () => {
  it('aggregates counts across companies', () => {
    const results: Array<ContaSyncCompanyResult> = [
      { companyId: 'a', updated: 2, created: 1, skipped: 0, errors: [] },
      {
        companyId: 'b',
        updated: 1,
        created: 0,
        skipped: 2,
        errors: ['one error'],
      },
    ]
    expect(summarizeContaSyncResults(results)).toBe(
      '3 updated, 1 created, 2 skipped, 1 errors',
    )
  })
})
