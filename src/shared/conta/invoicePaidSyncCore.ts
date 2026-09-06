/**
 * Conta → Grid invoice paid sync core.
 * Read-only Conta GETs; updates job_invoices + linked jobs.
 * No path aliases — safe for Vercel serverless.
 */

import { isContaInvoicePaid } from './contaInvoicePaid.js'
import type { ContaFetch } from './customerSyncCore.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../types/database.types.js'

export type ContaInvoicePayload = {
  id?: number | string
  invoiceId?: number | string
  invoiceNo?: number | string
  status?: string
  extendedStatus?: string
  [key: string]: unknown
}

export type JobInvoiceSyncRow = {
  id: string
  job_id: string
  organization_id: string
  conta_invoice_id: string | null
  status: string
  conta_response: ContaInvoicePayload | null
}

export type InvoicePaidSyncPaidItem = {
  jobInvoiceId: string
  contaInvoiceId: string | null
  jobsMarkedPaid: number
  newlyMarkedPaid: boolean
}

export type InvoicePaidSyncResult = {
  checked: number
  invoicesMarkedPaid: number
  jobsMarkedPaid: number
  skipped: number
  errors: Array<string>
  /** Invoices Conta reported as paid during this run. */
  paidInvoices: Array<InvoicePaidSyncPaidItem>
}

function asContaInvoice(value: unknown): ContaInvoicePayload | null {
  if (!value || typeof value !== 'object') return null
  return value as ContaInvoicePayload
}

export function extractContaNumericInvoiceId(
  invoice: JobInvoiceSyncRow,
): string | null {
  const response = asContaInvoice(invoice.conta_response)
  const fromResponse = response?.id ?? response?.invoiceId
  if (fromResponse != null && String(fromResponse).trim() !== '') {
    return String(fromResponse)
  }
  return null
}

export async function fetchContaInvoice(
  conta: ContaFetch,
  organizationId: string,
  invoice: JobInvoiceSyncRow,
): Promise<ContaInvoicePayload | null> {
  const preferredId = extractContaNumericInvoiceId(invoice)
  if (preferredId) {
    const fetched = await conta.get(
      `/invoice/organizations/${organizationId}/invoices/${preferredId}`,
    )
    return asContaInvoice(fetched)
  }

  const invoiceNo = invoice.conta_invoice_id
  if (!invoiceNo) return null

  const searchResponse = await conta.get(
    `/invoice/organizations/${organizationId}/invoices?invoiceNo=${encodeURIComponent(invoiceNo)}`,
  )

  const hits = Array.isArray(searchResponse)
    ? searchResponse
    : Array.isArray(
          (searchResponse as { hits?: Array<{ id?: number | string }> }).hits,
        )
      ? (searchResponse as { hits: Array<{ id?: number | string }> }).hits
      : []

  const hitId = hits[0]?.id
  if (hitId == null) return null

  const fetched = await conta.get(
    `/invoice/organizations/${organizationId}/invoices/${hitId}`,
  )
  return asContaInvoice(fetched)
}

export function resolveContaInvoiceIdString(
  invoice: JobInvoiceSyncRow,
  contaInvoice: ContaInvoicePayload,
): string | null {
  return (
    invoice.conta_invoice_id ||
    (contaInvoice.invoiceNo != null ? String(contaInvoice.invoiceNo) : null) ||
    (contaInvoice.id != null ? String(contaInvoice.id) : null) ||
    (contaInvoice.invoiceId != null ? String(contaInvoice.invoiceId) : null) ||
    null
  )
}

/**
 * Apply a Conta invoice payload to one job_invoices row and mark linked jobs paid.
 * Used by cron (batch) and Invoice History (per-job UI sync).
 */
export async function applyContaInvoicePaidSync(
  supabase: SupabaseClient<Database>,
  invoice: JobInvoiceSyncRow,
  contaInvoice: ContaInvoicePayload,
): Promise<{ invoiceMarkedPaid: boolean; jobsMarkedPaid: number }> {
  const paid = isContaInvoicePaid(contaInvoice)
  const nextContaInvoiceId = resolveContaInvoiceIdString(invoice, contaInvoice)

  const updatePayload: {
    conta_response: Json
    conta_invoice_id: string | null
    status?: string
  } = {
    conta_response: contaInvoice as Json,
    conta_invoice_id: nextContaInvoiceId,
  }
  if (paid && invoice.status !== 'paid') {
    updatePayload.status = 'paid'
  }

  const { error: updateError } = await supabase
    .from('job_invoices')
    .update(updatePayload)
    .eq('id', invoice.id)

  if (updateError) {
    throw new Error(
      `Failed to update job_invoice ${invoice.id}: ${updateError.message}`,
    )
  }

  if (!paid) {
    return { invoiceMarkedPaid: false, jobsMarkedPaid: 0 }
  }

  const { data: junctionRows, error: junctionError } = await supabase
    .from('job_invoice_jobs')
    .select('job_id')
    .eq('invoice_id', invoice.id)

  if (junctionError) {
    throw new Error(
      `Failed to load job_invoice_jobs for ${invoice.id}: ${junctionError.message}`,
    )
  }

  const jobIds = new Set<string>([invoice.job_id])
  for (const row of junctionRows ?? []) {
    if (row.job_id) jobIds.add(row.job_id)
  }

  const ids = [...jobIds]
  if (ids.length === 0) {
    return {
      invoiceMarkedPaid: invoice.status !== 'paid',
      jobsMarkedPaid: 0,
    }
  }

  const { data: updatedJobs, error: jobsError } = await supabase
    .from('jobs')
    .update({ status: 'paid' })
    .in('id', ids)
    .eq('status', 'invoiced')
    .select('id')

  if (jobsError) {
    throw new Error(
      `Failed to mark jobs paid for invoice ${invoice.id}: ${jobsError.message}`,
    )
  }

  return {
    invoiceMarkedPaid: invoice.status !== 'paid',
    jobsMarkedPaid: updatedJobs?.length ?? 0,
  }
}

export type InvoicePaidSyncProgress = {
  current: number
  total: number
}

/**
 * Sync unpaid Conta-linked invoices for one Conta organization.
 */
export async function syncInvoicePaidStatusForOrganization(
  organizationId: string,
  conta: ContaFetch,
  supabase: SupabaseClient<Database>,
  opts?: { onProgress?: (progress: InvoicePaidSyncProgress) => void },
): Promise<InvoicePaidSyncResult> {
  const result: InvoicePaidSyncResult = {
    checked: 0,
    invoicesMarkedPaid: 0,
    jobsMarkedPaid: 0,
    skipped: 0,
    errors: [],
    paidInvoices: [],
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from('job_invoices')
    .select(
      'id, job_id, organization_id, conta_invoice_id, status, conta_response',
    )
    .eq('organization_id', organizationId)
    .not('conta_invoice_id', 'is', null)
    .neq('status', 'paid')
    .neq('status', 'failed')

  if (invoicesError) {
    result.errors.push(invoicesError.message)
    return result
  }

  const rows = invoices ?? []
  const total = rows.length
  opts?.onProgress?.({ current: 0, total })

  const recordPaid = (
    invoice: JobInvoiceSyncRow,
    applied: { invoiceMarkedPaid: boolean; jobsMarkedPaid: number },
    contaInvoiceId: string | null,
  ) => {
    result.paidInvoices.push({
      jobInvoiceId: invoice.id,
      contaInvoiceId: contaInvoiceId ?? invoice.conta_invoice_id,
      jobsMarkedPaid: applied.jobsMarkedPaid,
      newlyMarkedPaid: applied.invoiceMarkedPaid,
    })
  }

  for (let i = 0; i < rows.length; i++) {
    const invoice = rows[i] as JobInvoiceSyncRow
    if (!invoice.conta_invoice_id) {
      result.skipped += 1
      opts?.onProgress?.({ current: i + 1, total })
      continue
    }

    // Skip Conta GET if stored response already says paid; still persist status/jobs
    if (isContaInvoicePaid(asContaInvoice(invoice.conta_response))) {
      try {
        const applied = await applyContaInvoicePaidSync(
          supabase,
          invoice,
          asContaInvoice(invoice.conta_response)!,
        )
        result.checked += 1
        if (applied.invoiceMarkedPaid) result.invoicesMarkedPaid += 1
        result.jobsMarkedPaid += applied.jobsMarkedPaid
        recordPaid(invoice, applied, invoice.conta_invoice_id)
      } catch (e: unknown) {
        result.checked += 1
        result.errors.push(
          e instanceof Error ? e.message : `Invoice ${invoice.id}: sync failed`,
        )
      }
      opts?.onProgress?.({ current: i + 1, total })
      continue
    }

    result.checked += 1
    try {
      const contaInvoice = await fetchContaInvoice(
        conta,
        organizationId,
        invoice,
      )
      if (!contaInvoice) {
        result.skipped += 1
        result.errors.push(
          `Conta invoice not found for job_invoice ${invoice.id} (${invoice.conta_invoice_id})`,
        )
        opts?.onProgress?.({ current: i + 1, total })
        continue
      }

      const applied = await applyContaInvoicePaidSync(
        supabase,
        invoice,
        contaInvoice,
      )
      if (applied.invoiceMarkedPaid) result.invoicesMarkedPaid += 1
      result.jobsMarkedPaid += applied.jobsMarkedPaid
      if (isContaInvoicePaid(contaInvoice)) {
        recordPaid(
          invoice,
          applied,
          resolveContaInvoiceIdString(invoice, contaInvoice),
        )
      }
    } catch (e: unknown) {
      result.errors.push(
        e instanceof Error
          ? e.message
          : `Invoice ${invoice.id}: Conta sync failed`,
      )
    }
    opts?.onProgress?.({ current: i + 1, total })
  }

  return result
}
