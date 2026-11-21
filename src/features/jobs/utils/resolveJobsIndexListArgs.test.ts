import { describe, expect, it } from 'vitest'
import { resolveJobsIndexListArgs } from './resolveJobsIndexListArgs'

describe('resolveJobsIndexListArgs', () => {
  const base = {
    companyRole: 'employee' as string | null,
    showJobsInRecurringSeries: false,
    readyToInvoiceFilter: false,
    accountingUnverifiedFilter: false,
    showMyJobsOnly: false,
    statusFilter: ['planned', 'confirmed'] as const,
    userId: 'user-1',
  }

  it('passes status filter and excludes recurring members by default', () => {
    expect(
      resolveJobsIndexListArgs({
        ...base,
        statusFilter: [...base.statusFilter],
      }),
    ).toEqual({
      includeRecurringMembers: false,
      projectLeadUserId: null,
      statuses: ['planned', 'confirmed'],
    })
  })

  it('includes recurring members for freelancers, series toggle, ready-to-invoice, or my-jobs', () => {
    expect(
      resolveJobsIndexListArgs({
        ...base,
        statusFilter: [...base.statusFilter],
        companyRole: 'freelancer',
      }).includeRecurringMembers,
    ).toBe(true)
    expect(
      resolveJobsIndexListArgs({
        ...base,
        statusFilter: [...base.statusFilter],
        showJobsInRecurringSeries: true,
      }).includeRecurringMembers,
    ).toBe(true)
    expect(
      resolveJobsIndexListArgs({
        ...base,
        statusFilter: [...base.statusFilter],
        showMyJobsOnly: true,
      }).includeRecurringMembers,
    ).toBe(true)
  })

  it('forces completed + project lead when ready-to-invoice is on', () => {
    expect(
      resolveJobsIndexListArgs({
        ...base,
        statusFilter: [...base.statusFilter],
        readyToInvoiceFilter: true,
      }),
    ).toEqual({
      includeRecurringMembers: true,
      projectLeadUserId: 'user-1',
      statuses: ['completed'],
    })
  })

  it('forces invoiced/paid + project lead when accounting-unverified is on', () => {
    expect(
      resolveJobsIndexListArgs({
        ...base,
        statusFilter: [...base.statusFilter],
        accountingUnverifiedFilter: true,
      }),
    ).toEqual({
      includeRecurringMembers: true,
      projectLeadUserId: 'user-1',
      statuses: ['invoiced', 'paid'],
    })
  })

  it('uses null statuses when the filter is empty and not ready-to-invoice', () => {
    expect(
      resolveJobsIndexListArgs({
        ...base,
        statusFilter: [],
      }).statuses,
    ).toBeNull()
  })
})
