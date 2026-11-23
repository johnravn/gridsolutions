import type { RecurringJobAccountingEntry } from '../types'

type SeriesJob = {
  id: string
  archived: boolean
}

export function getSeriesAccountingStatus(
  jobs: ReadonlyArray<SeriesJob>,
  accountingSummary: ReadonlyArray<RecurringJobAccountingEntry>,
) {
  const activeJobs = jobs.filter((job) => !job.archived)
  const summaryByJobId = new Map(
    accountingSummary.map((entry) => [entry.job_id, entry]),
  )

  let verifiedCount = 0
  let unverifiedCount = 0
  let withLedgerCount = 0
  let incomeTotal = 0
  let expenseTotal = 0

  for (const job of activeJobs) {
    const entry = summaryByJobId.get(job.id)
    const verified = entry?.money_verified_at != null
    if (verified) verifiedCount += 1
    else unverifiedCount += 1
    if ((entry?.item_count ?? 0) > 0) withLedgerCount += 1
    incomeTotal += entry?.income_total ?? 0
    expenseTotal += entry?.expense_total ?? 0
  }

  return {
    activeJobs,
    verifiedCount,
    unverifiedCount,
    withLedgerCount,
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal,
    seriesFullyVerified:
      activeJobs.length > 0 && verifiedCount === activeJobs.length,
  }
}

export function canVerifyJobAccounting({
  userId,
  isGlobalSuperuser,
  companyRole,
  projectLeadUserId,
}: {
  userId: string | null | undefined
  isGlobalSuperuser: boolean
  companyRole: string | null | undefined
  projectLeadUserId: string | null | undefined
}): boolean {
  if (!userId) return false
  if (isGlobalSuperuser) return true
  if (companyRole === 'owner' || companyRole === 'super_user') return true
  return !!projectLeadUserId && projectLeadUserId === userId
}
