// src/features/jobs/api/createContaInvoice.ts
import { supabase } from '@shared/api/supabase'
import { contaClient } from '@shared/api/conta/client'
import {
  addLocalCalendarDays,
  formatLocalYmd,
} from '@shared/lib/generalFunctions'
import { ensureContaProjectId } from '../utils/contaProjects'
import type { BookingsForInvoice } from './invoiceQueries'

export type InvoiceRecipient = { type: string; ehfRecipient?: string }

export function getVatCode(vatPercent: number): string {
  if (vatPercent === 0) return 'no.vat'
  if (vatPercent >= 20) return 'high'
  if (vatPercent >= 10) return 'medium'
  if (vatPercent > 0) return 'low'
  return 'high'
}

export type CreateContaInvoiceParams = {
  primaryJobId: string
  linkedJobIds: Array<string>
  jobTitle: string
  jobnr: number | null
  contaCustomerId: number
  bookingsData: BookingsForInvoice
  organizationId: string
  invoiceRecipients: Array<InvoiceRecipient>
  invoiceMessage?: string
  orgReference?: string
  customerReference?: string
  ehfOrderReference?: string
  lineDiscountOverrides?: Record<string, number>
  invoiceWithVat?: boolean
  offerId?: string | null
  createdByUserId?: string | null
  daysUntilDue: number
  /** Stored in invoice_data for history display */
  linkedJobMeta?: Array<{
    id: string
    title: string
    jobnr: number | null
  }>
}

export async function createContaInvoiceFromBookings(
  params: CreateContaInvoiceParams,
): Promise<{ response: unknown; invoiceRecord: { id: string } | null }> {
  const {
    primaryJobId,
    linkedJobIds,
    jobTitle,
    jobnr,
    contaCustomerId,
    bookingsData,
    organizationId,
    invoiceRecipients,
    invoiceMessage,
    orgReference,
    customerReference,
    ehfOrderReference,
    lineDiscountOverrides = {},
    invoiceWithVat = true,
    offerId = null,
    createdByUserId = null,
    daysUntilDue,
    linkedJobMeta = [],
  } = params

  const contaProjectId = await ensureContaProjectId(organizationId, {
    jobTitle,
    jobnr,
    jobId: primaryJobId,
    customerId: contaCustomerId,
  })
  if (contaProjectId == null) {
    throw new Error(
      'Could not resolve a Conta project for this job (no id returned). Check Conta and try again.',
    )
  }

  if (bookingsData.all.length === 0) {
    throw new Error('No bookings available to invoice')
  }

  const invoiceLines = bookingsData.all.map((line, index) => ({
    description: line.description,
    quantity: line.quantity,
    price: line.unitPrice,
    discount: lineDiscountOverrides[line.id] ?? 0,
    vatCode: getVatCode(invoiceWithVat ? line.vatPercent : 0),
    lineNo: index + 1,
  }))

  const invoiceDateLocal = new Date()
  const invoiceDueDateLocal = addLocalCalendarDays(
    invoiceDateLocal,
    daysUntilDue,
  )
  const shouldSendEhf =
    invoiceRecipients[0] && invoiceRecipients[0].type === 'EHF'

  const invoiceDataForDb = {
    customerId: contaCustomerId,
    invoiceDate: formatLocalYmd(invoiceDateLocal),
    invoiceDueDate: formatLocalYmd(invoiceDueDateLocal),
    invoiceCurrency: 'NOK',
    projectId: contaProjectId,
    ...(shouldSendEhf ? { invoiceRecipients } : {}),
    ...(shouldSendEhf && ehfOrderReference ? { ehfOrderReference } : {}),
    ...(orgReference ? { orgReference } : {}),
    ...(customerReference ? { customerReference } : {}),
    personalMessage: invoiceMessage?.trim() || '',
    invoiceLines,
    linkedJobIds,
    linkedJobMeta,
  }

  const contaPayload = {
    customerId: invoiceDataForDb.customerId,
    invoiceDate: invoiceDataForDb.invoiceDate,
    invoiceDueDate: invoiceDataForDb.invoiceDueDate,
    invoiceCurrency: invoiceDataForDb.invoiceCurrency,
    projectId: invoiceDataForDb.projectId,
    ...(shouldSendEhf ? { invoiceRecipients } : {}),
    ...(shouldSendEhf && ehfOrderReference ? { ehfOrderReference } : {}),
    ...(orgReference ? { orgReference } : {}),
    ...(customerReference ? { customerReference } : {}),
    personalMessage: invoiceDataForDb.personalMessage,
    invoiceLines,
  }

  const { data: invoiceRecord, error: recordError } = await supabase
    .from('job_invoices')
    .insert({
      job_id: primaryJobId,
      offer_id: offerId ?? null,
      organization_id: organizationId,
      conta_customer_id: contaCustomerId,
      invoice_basis: offerId ? 'offer' : 'bookings',
      invoice_data: invoiceDataForDb as never,
      status: 'pending',
      created_by_user_id: createdByUserId,
    })
    .select()
    .single()

  if (recordError) {
    console.error('Failed to create invoice record:', recordError)
  }

  try {
    const response = await contaClient.post(
      `/invoice/organizations/${organizationId}/invoices`,
      contaPayload,
    )

    if (invoiceRecord) {
      const resp = response as Record<string, unknown>
      await supabase
        .from('job_invoices')
        .update({
          status: 'created',
          conta_invoice_id:
            resp?.invoiceNo?.toString() ||
            resp?.id?.toString() ||
            resp?.invoiceId?.toString() ||
            null,
          conta_response: response as never,
        })
        .eq('id', invoiceRecord.id)

      const junctionRows = linkedJobIds.map((jobId) => ({
        invoice_id: invoiceRecord.id,
        job_id: jobId,
      }))
      if (junctionRows.length > 0) {
        await supabase.from('job_invoice_jobs').insert(junctionRows)
      }
    }

    return { response, invoiceRecord }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    if (invoiceRecord) {
      await supabase
        .from('job_invoices')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', invoiceRecord.id)
    }
    throw error
  }
}

export async function markJobsInvoiced(jobIds: Array<string>): Promise<void> {
  if (jobIds.length === 0) return
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status')
    .in('id', jobIds)

  const toUpdate = (jobs ?? [])
    .filter((j) => j.status !== 'paid' && j.status !== 'invoiced')
    .map((j) => j.id)

  if (toUpdate.length === 0) return

  await supabase.from('jobs').update({ status: 'invoiced' }).in('id', toUpdate)
}
