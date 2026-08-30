import { describe, expect, it } from 'vitest'
import { getSeriesInvoiceStatus } from './seriesInvoiceStatus'
import type { JobStatus, RecurringJobInvoiceEntry } from '../types'

function job(id: string, status: JobStatus, archived = false) {
  return { id, status, archived }
}

function summary(
  jobId: string,
  status: JobStatus,
  invoiceCount: number,
): RecurringJobInvoiceEntry {
  return {
    job_id: jobId,
    job_title: jobId,
    jobnr: null,
    status,
    invoice_count: invoiceCount,
    last_invoice_at: null,
  }
}

describe('getSeriesInvoiceStatus', () => {
  it('counts ready, invoiced, and paid jobs across the series', () => {
    const result = getSeriesInvoiceStatus(
      [
        job('a', 'completed'),
        job('b', 'invoiced'),
        job('c', 'paid'),
        job('d', 'completed', true),
      ],
      [
        summary('a', 'completed', 0),
        summary('b', 'invoiced', 1),
        summary('c', 'paid', 1),
        summary('d', 'completed', 0),
      ],
    )

    expect(result.activeJobs).toHaveLength(3)
    expect(result.readyCount).toBe(1)
    expect(result.invoicedCount).toBe(2)
    expect(result.paidCount).toBe(1)
    expect(result.seriesFullyInvoiced).toBe(false)
  })

  it('treats a completed job with invoice history as invoiced', () => {
    const result = getSeriesInvoiceStatus(
      [job('a', 'completed')],
      [summary('a', 'completed', 2)],
    )

    expect(result.readyCount).toBe(0)
    expect(result.invoicedCount).toBe(1)
    expect(result.seriesFullyInvoiced).toBe(true)
  })

  it('marks an empty series as not fully invoiced', () => {
    const result = getSeriesInvoiceStatus([], [])
    expect(result.seriesFullyInvoiced).toBe(false)
    expect(result.activeJobs).toHaveLength(0)
  })
})
