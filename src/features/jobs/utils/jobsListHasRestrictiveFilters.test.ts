import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_FILTER } from '../components/JobsFilter'
import { jobsListHasRestrictiveFilters } from './jobsListHasRestrictiveFilters'

describe('jobsListHasRestrictiveFilters', () => {
  const open = {
    statusFilter: [] as Array<(typeof DEFAULT_STATUS_FILTER)[number]>,
    showOnlyArchived: false,
    showJobsInRecurringSeries: true,
    showMyJobsOnly: false,
    dateFrom: '',
    dateTo: '',
    readyToInvoiceFilter: false,
    accountingUnverifiedFilter: false,
  }

  it('is false when the list matches an unfiltered search', () => {
    expect(jobsListHasRestrictiveFilters(open)).toBe(false)
  })

  it('is true for the default active status filter', () => {
    expect(
      jobsListHasRestrictiveFilters({
        ...open,
        statusFilter: [...DEFAULT_STATUS_FILTER],
      }),
    ).toBe(true)
  })

  it('is true when dates, my-jobs, or accounting queue filters are on', () => {
    expect(
      jobsListHasRestrictiveFilters({ ...open, dateFrom: '2026-01-01' }),
    ).toBe(true)
    expect(
      jobsListHasRestrictiveFilters({ ...open, showMyJobsOnly: true }),
    ).toBe(true)
    expect(
      jobsListHasRestrictiveFilters({
        ...open,
        accountingUnverifiedFilter: true,
      }),
    ).toBe(true)
  })
})
