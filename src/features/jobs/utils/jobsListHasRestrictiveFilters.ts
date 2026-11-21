import { DEFAULT_STATUS_FILTER } from '../components/JobsFilter'
import type { JobStatus } from '../types'

function sameStatusSet(a: Array<JobStatus>, b: Array<JobStatus>): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((s) => set.has(s))
}

/**
 * True when the Jobs list query is narrower than an unfiltered search
 * (all statuses, all dates, include recurring members, non-archived).
 */
export function jobsListHasRestrictiveFilters({
  statusFilter,
  showOnlyArchived,
  showJobsInRecurringSeries,
  showMyJobsOnly,
  dateFrom,
  dateTo,
  readyToInvoiceFilter,
  accountingUnverifiedFilter,
}: {
  statusFilter: Array<JobStatus>
  showOnlyArchived: boolean
  showJobsInRecurringSeries: boolean
  showMyJobsOnly: boolean
  dateFrom: string
  dateTo: string
  readyToInvoiceFilter: boolean
  accountingUnverifiedFilter: boolean
}): boolean {
  // Default active statuses still hide paid/invoiced/completed — restrictive
  // relative to an all-status search.
  const statusIsWideOpen = statusFilter.length === 0
  const statusIsDefault = sameStatusSet(statusFilter, DEFAULT_STATUS_FILTER)
  return (
    !statusIsWideOpen ||
    statusIsDefault ||
    showOnlyArchived ||
    !showJobsInRecurringSeries ||
    showMyJobsOnly ||
    !!dateFrom ||
    !!dateTo ||
    readyToInvoiceFilter ||
    accountingUnverifiedFilter
  )
}
