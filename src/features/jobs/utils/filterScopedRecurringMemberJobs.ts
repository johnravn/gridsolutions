import {
  jobOverlapsDateFilter,
  resolveJobsIndexDateOverlap,
} from '../api/jobsIndexDateOverlap'
import type { JobListRow, JobStatus } from '../types'

export type ScopedRecurringMemberJobFilters = {
  search?: string
  statusFilter?: Array<JobStatus>
  showOnlyArchived?: boolean
  dateFrom?: string
  dateTo?: string
  readyToInvoiceFilter?: boolean
  projectLeadUserId?: string | null
  onlyJobIds?: Array<string> | null
}

/**
 * Apply the same Jobs list filters to member jobs when drilling into a
 * recurring series. The series detail query returns all members, so filtering
 * happens client-side to match the main jobs index.
 */
export function filterScopedRecurringMemberJobs(
  jobs: Array<JobListRow>,
  {
    search = '',
    statusFilter = [],
    showOnlyArchived = false,
    dateFrom = '',
    dateTo = '',
    readyToInvoiceFilter = false,
    projectLeadUserId = null,
    onlyJobIds = null,
  }: ScopedRecurringMemberJobFilters,
): Array<JobListRow> {
  let result = jobs

  if (showOnlyArchived) {
    result = result.filter((job) => job.archived)
  } else {
    result = result.filter((job) => !job.archived)
  }

  const statuses: Array<JobStatus> | null = readyToInvoiceFilter
    ? ['completed']
    : statusFilter.length > 0
      ? statusFilter
      : null
  if (statuses) {
    result = result.filter((job) => statuses.includes(job.status))
  }

  if (readyToInvoiceFilter && projectLeadUserId) {
    result = result.filter(
      (job) => job.project_lead?.user_id === projectLeadUserId,
    )
  }

  if (onlyJobIds) {
    const idSet = new Set(onlyJobIds)
    result = result.filter((job) => idSet.has(job.id))
  }

  const overlap = resolveJobsIndexDateOverlap(
    dateFrom || undefined,
    dateTo || undefined,
  )
  if (overlap.kind !== 'none') {
    result = result.filter((job) => jobOverlapsDateFilter(job, overlap))
  }

  const q = search.trim().toLowerCase()
  if (q) {
    result = result.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        (job.jobnr != null && String(job.jobnr).includes(q)),
    )
  }

  return result
}
