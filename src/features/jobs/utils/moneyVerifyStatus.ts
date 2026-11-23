import type { JobStatus } from '../types'

/** Job statuses that may mark Accounting as verified for Reporting. */
export const JOB_MONEY_VERIFY_STATUSES = [
  'invoiced',
  'paid',
  'canceled',
] as const satisfies ReadonlyArray<JobStatus>

export type JobMoneyVerifyStatus = (typeof JOB_MONEY_VERIFY_STATUSES)[number]

export const JOB_MONEY_VERIFY_STATUS_HINT =
  'Accounting can only be verified when the job status is Invoiced, Paid, or Canceled.'

export function isJobStatusEligibleForMoneyVerify(
  status: string | null | undefined,
): status is JobMoneyVerifyStatus {
  return (
    !!status &&
    (JOB_MONEY_VERIFY_STATUSES as ReadonlyArray<string>).includes(status)
  )
}
