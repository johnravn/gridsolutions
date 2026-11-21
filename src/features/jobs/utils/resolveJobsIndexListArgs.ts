import type { JobStatus } from '../types'

export type JobsIndexListArgsInput = {
  companyRole: string | null
  showJobsInRecurringSeries: boolean
  readyToInvoiceFilter: boolean
  accountingUnverifiedFilter: boolean
  showMyJobsOnly: boolean
  statusFilter: Array<JobStatus>
  userId: string | null | undefined
}

export type JobsIndexListArgs = {
  includeRecurringMembers: boolean
  projectLeadUserId: string | null
  statuses: Array<JobStatus> | null
}

/**
 * Shared Jobs index filter assembly for JobsPage (skeleton query) and JobsList.
 * Keep ready-to-invoice / accounting-unverified / recurring-member / my-jobs
 * knowledge in one place.
 */
export function resolveJobsIndexListArgs({
  companyRole,
  showJobsInRecurringSeries,
  readyToInvoiceFilter,
  accountingUnverifiedFilter,
  showMyJobsOnly,
  statusFilter,
  userId,
}: JobsIndexListArgsInput): JobsIndexListArgs {
  return {
    includeRecurringMembers:
      companyRole === 'freelancer' ||
      showJobsInRecurringSeries ||
      readyToInvoiceFilter ||
      accountingUnverifiedFilter ||
      showMyJobsOnly,
    projectLeadUserId:
      readyToInvoiceFilter || accountingUnverifiedFilter
        ? (userId ?? null)
        : null,
    statuses: readyToInvoiceFilter
      ? (['completed'] as Array<JobStatus>)
      : accountingUnverifiedFilter
        ? (['invoiced', 'paid'] as Array<JobStatus>)
        : statusFilter.length > 0
          ? statusFilter
          : null,
  }
}
