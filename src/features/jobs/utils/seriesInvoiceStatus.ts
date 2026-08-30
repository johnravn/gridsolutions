import type { JobStatus, RecurringJobInvoiceEntry } from '../types'

type SeriesJob = {
  id: string
  archived: boolean
  status: JobStatus
}

export function getSeriesInvoiceStatus(
  jobs: ReadonlyArray<SeriesJob>,
  invoiceSummary: ReadonlyArray<RecurringJobInvoiceEntry>,
) {
  const activeJobs = jobs.filter((job) => !job.archived)
  const summaryByJobId = new Map(
    invoiceSummary.map((entry) => [entry.job_id, entry]),
  )

  let invoicedCount = 0
  let paidCount = 0
  let readyCount = 0

  for (const job of activeJobs) {
    const entry = summaryByJobId.get(job.id)
    const invoiceCount = entry?.invoice_count ?? 0
    const status = entry?.status ?? job.status
    if (status === 'paid') paidCount += 1
    if (status === 'invoiced' || status === 'paid' || invoiceCount > 0) {
      invoicedCount += 1
    }
    if (status === 'completed' && invoiceCount === 0) readyCount += 1
  }

  return {
    activeJobs,
    invoicedCount,
    paidCount,
    readyCount,
    seriesFullyInvoiced:
      activeJobs.length > 0 && invoicedCount === activeJobs.length,
  }
}
