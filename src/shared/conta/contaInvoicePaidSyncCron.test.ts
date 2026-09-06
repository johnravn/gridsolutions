import { describe, expect, it } from 'vitest'
import {
  deriveInvoicePaidSyncStatus,
  summarizeInvoicePaidSyncResults,
  type ContaInvoicePaidSyncCompanyResult,
} from './contaInvoicePaidSyncCron'

describe('deriveInvoicePaidSyncStatus', () => {
  it('returns failed for top-level error', () => {
    expect(deriveInvoicePaidSyncStatus([], 'config error')).toBe('failed')
  })

  it('returns success for empty results', () => {
    expect(deriveInvoicePaidSyncStatus([])).toBe('success')
  })

  it('returns success when companies sync cleanly', () => {
    const results: Array<ContaInvoicePaidSyncCompanyResult> = [
      {
        companyId: 'a',
        checked: 2,
        invoicesMarkedPaid: 1,
        jobsMarkedPaid: 1,
        skipped: 0,
        errors: [],
      },
    ]
    expect(deriveInvoicePaidSyncStatus(results)).toBe('success')
  })

  it('returns partial when a company has errors', () => {
    const results: Array<ContaInvoicePaidSyncCompanyResult> = [
      {
        companyId: 'a',
        checked: 1,
        invoicesMarkedPaid: 0,
        jobsMarkedPaid: 0,
        skipped: 0,
        errors: ['not found'],
      },
    ]
    expect(deriveInvoicePaidSyncStatus(results)).toBe('partial')
  })

  it('returns failed when every company failed', () => {
    const results: Array<ContaInvoicePaidSyncCompanyResult> = [
      {
        companyId: 'a',
        checked: 0,
        invoicesMarkedPaid: 0,
        jobsMarkedPaid: 0,
        skipped: 0,
        errors: ['RPC failed'],
      },
    ]
    expect(deriveInvoicePaidSyncStatus(results)).toBe('failed')
  })
})

describe('summarizeInvoicePaidSyncResults', () => {
  it('aggregates counts', () => {
    const results: Array<ContaInvoicePaidSyncCompanyResult> = [
      {
        companyId: 'a',
        checked: 2,
        invoicesMarkedPaid: 1,
        jobsMarkedPaid: 2,
        skipped: 0,
        errors: [],
      },
      {
        companyId: 'b',
        checked: 1,
        invoicesMarkedPaid: 0,
        jobsMarkedPaid: 0,
        skipped: 1,
        errors: ['x'],
      },
    ]
    expect(summarizeInvoicePaidSyncResults(results)).toBe(
      '3 checked, 1 invoices paid, 2 jobs paid, 1 skipped, 1 errors',
    )
  })
})
