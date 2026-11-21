import { supabase } from '@shared/api/supabase'
import { contaClient } from '@shared/api/conta/client'
import { fetchContaInvoiceByNumber } from '@shared/conta/invoicePaidSyncCore'
import { isContaInvoicePaid } from '@shared/conta/contaInvoicePaid'
import { markJobsInvoiced } from './createContaInvoice'
import type { ContaInvoicePayload } from '@shared/conta/invoicePaidSyncCore'

export type LinkContaInvoiceJobMeta = {
  id: string
  title: string
  jobnr: number | null
}

export type LinkContaInvoiceParams = {
  jobId: string
  organizationId: string
  invoiceNumber: string
  jobMeta: LinkContaInvoiceJobMeta
  createdByUserId?: string | null
}

export type LinkContaInvoiceResult =
  | {
      kind: 'linked'
      invoiceId: string
      contaInvoiceId: string
      alreadyOnOtherJobs: Array<LinkContaInvoiceJobMeta>
    }
  | {
      kind: 'already_linked'
      invoiceId: string
      contaInvoiceId: string
    }
  | {
      kind: 'added_to_existing'
      invoiceId: string
      contaInvoiceId: string
      primaryJob: LinkContaInvoiceJobMeta
    }

function normalizeInvoiceNumber(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim()
}

function contaInvoiceNumber(payload: ContaInvoicePayload): string | null {
  if (payload.invoiceNo != null && String(payload.invoiceNo).trim() !== '') {
    return String(payload.invoiceNo).trim()
  }
  if (payload.id != null && String(payload.id).trim() !== '') {
    return String(payload.id).trim()
  }
  if (payload.invoiceId != null && String(payload.invoiceId).trim() !== '') {
    return String(payload.invoiceId).trim()
  }
  return null
}

function asCustomerId(payload: ContaInvoicePayload): number | null {
  const raw = payload.customerId
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function buildInvoiceDataFromConta(
  payload: ContaInvoicePayload,
  jobMeta: LinkContaInvoiceJobMeta,
): Record<string, unknown> {
  return {
    linkedFrom: 'conta_invoice_number',
    customerId: asCustomerId(payload),
    invoiceDate: payload.invoiceDate ?? null,
    invoiceDueDate: payload.invoiceDueDate ?? null,
    invoiceCurrency: payload.invoiceCurrency ?? payload.currency ?? 'NOK',
    projectId: payload.projectId ?? null,
    orgReference: payload.orgReference ?? null,
    customerReference: payload.customerReference ?? null,
    personalMessage: payload.personalMessage ?? null,
    ehfOrderReference: payload.ehfOrderReference ?? null,
    invoiceLines: Array.isArray(payload.invoiceLines)
      ? payload.invoiceLines
      : [],
    linkedJobIds: [jobMeta.id],
    linkedJobMeta: [
      {
        id: jobMeta.id,
        title: jobMeta.title,
        jobnr: jobMeta.jobnr,
      },
    ],
  }
}

async function loadJobMeta(
  jobId: string,
): Promise<LinkContaInvoiceJobMeta | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, jobnr')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    title: data.title,
    jobnr: data.jobnr,
  }
}

async function findExistingByContaNumber(
  organizationId: string,
  contaInvoiceId: string,
): Promise<Array<{ id: string; job_id: string }>> {
  const { data, error } = await supabase
    .from('job_invoices')
    .select('id, job_id')
    .eq('organization_id', organizationId)
    .eq('conta_invoice_id', contaInvoiceId)
  if (error) throw error
  return data ?? []
}

async function jobAlreadyOnInvoice(
  invoiceId: string,
  jobId: string,
  primaryJobId: string,
): Promise<boolean> {
  if (primaryJobId === jobId) return true
  const { data, error } = await supabase
    .from('job_invoice_jobs')
    .select('job_id')
    .eq('invoice_id', invoiceId)
    .eq('job_id', jobId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

async function appendJobMetaOnInvoice(
  invoiceId: string,
  jobMeta: LinkContaInvoiceJobMeta,
): Promise<void> {
  const { data: row, error } = await supabase
    .from('job_invoices')
    .select('invoice_data')
    .eq('id', invoiceId)
    .single()
  if (error) throw error

  const invoiceData =
    row.invoice_data &&
    typeof row.invoice_data === 'object' &&
    !Array.isArray(row.invoice_data)
      ? ({ ...(row.invoice_data as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {}

  const linkedJobIds = Array.isArray(invoiceData.linkedJobIds)
    ? (invoiceData.linkedJobIds as Array<unknown>).filter(
        (id): id is string => typeof id === 'string',
      )
    : []
  if (!linkedJobIds.includes(jobMeta.id)) {
    linkedJobIds.push(jobMeta.id)
  }

  const linkedJobMeta = Array.isArray(invoiceData.linkedJobMeta)
    ? ([...(invoiceData.linkedJobMeta as Array<unknown>)] as Array<
        Record<string, unknown>
      >)
    : []
  if (!linkedJobMeta.some((m) => m && m.id === jobMeta.id)) {
    linkedJobMeta.push({
      id: jobMeta.id,
      title: jobMeta.title,
      jobnr: jobMeta.jobnr,
    })
  }

  const { error: updateError } = await supabase
    .from('job_invoices')
    .update({
      invoice_data: {
        ...invoiceData,
        linkedJobIds,
        linkedJobMeta,
      } as never,
    })
    .eq('id', invoiceId)
  if (updateError) throw updateError
}

/**
 * Link an existing Conta sales invoice (by invoice number) to a Grid job.
 * Creates a `job_invoices` row when missing; if already linked elsewhere,
 * adds this job via `job_invoice_jobs` (multi-job pattern — no reassignment).
 */
export async function linkContaInvoiceByNumber(
  params: LinkContaInvoiceParams,
): Promise<LinkContaInvoiceResult> {
  const invoiceNumber = normalizeInvoiceNumber(params.invoiceNumber)
  if (!invoiceNumber) {
    throw new Error('Enter a Conta invoice number.')
  }
  if (!/^\d+$/.test(invoiceNumber)) {
    throw new Error('Invoice number must be digits only (e.g. 10042).')
  }

  const contaInvoice = await fetchContaInvoiceByNumber(
    contaClient,
    params.organizationId,
    invoiceNumber,
  )
  if (!contaInvoice) {
    throw new Error(
      `No Conta invoice found with number ${invoiceNumber}. Check the number and Conta organization.`,
    )
  }

  const contaInvoiceId = contaInvoiceNumber(contaInvoice) ?? invoiceNumber
  const existing = await findExistingByContaNumber(
    params.organizationId,
    contaInvoiceId,
  )

  // Prefer exact Conta number match; also try the typed number if Conta returned
  // a different canonical id string.
  const existingRows =
    existing.length > 0
      ? existing
      : invoiceNumber !== contaInvoiceId
        ? await findExistingByContaNumber(params.organizationId, invoiceNumber)
        : []

  if (existingRows.length > 0) {
    const primary = existingRows[0]
    const alreadyHere = await jobAlreadyOnInvoice(
      primary.id,
      params.jobId,
      primary.job_id,
    )
    if (alreadyHere) {
      return {
        kind: 'already_linked',
        invoiceId: primary.id,
        contaInvoiceId,
      }
    }

    const { error: junctionError } = await supabase
      .from('job_invoice_jobs')
      .insert({ invoice_id: primary.id, job_id: params.jobId })
    if (junctionError) throw junctionError

    await appendJobMetaOnInvoice(primary.id, params.jobMeta)

    // Refresh Conta payload on the existing row so Accounting can show lines.
    const paid = isContaInvoicePaid(contaInvoice)
    await supabase
      .from('job_invoices')
      .update({
        conta_response: contaInvoice as never,
        conta_invoice_id: contaInvoiceId,
        ...(paid ? { status: 'paid' } : {}),
      })
      .eq('id', primary.id)

    await markJobsInvoiced([params.jobId])

    const primaryMeta =
      (await loadJobMeta(primary.job_id)) ??
      ({
        id: primary.job_id,
        title: 'another job',
        jobnr: null,
      } satisfies LinkContaInvoiceJobMeta)

    return {
      kind: 'added_to_existing',
      invoiceId: primary.id,
      contaInvoiceId,
      primaryJob: primaryMeta,
    }
  }

  const paid = isContaInvoicePaid(contaInvoice)
  const invoiceData = buildInvoiceDataFromConta(contaInvoice, params.jobMeta)

  const { data: invoiceRecord, error: insertError } = await supabase
    .from('job_invoices')
    .insert({
      job_id: params.jobId,
      offer_id: null,
      organization_id: params.organizationId,
      conta_customer_id: asCustomerId(contaInvoice),
      invoice_basis: 'linked',
      invoice_data: invoiceData as never,
      conta_response: contaInvoice as never,
      conta_invoice_id: contaInvoiceId,
      status: paid ? 'paid' : 'created',
      created_by_user_id: params.createdByUserId ?? null,
    })
    .select('id')
    .single()

  if (insertError) throw insertError
  if (!invoiceRecord) {
    throw new Error('Failed to create invoice link record.')
  }

  const { error: junctionError } = await supabase
    .from('job_invoice_jobs')
    .insert({ invoice_id: invoiceRecord.id, job_id: params.jobId })
  if (junctionError) throw junctionError

  await markJobsInvoiced([params.jobId])

  return {
    kind: 'linked',
    invoiceId: invoiceRecord.id,
    contaInvoiceId,
    alreadyOnOtherJobs: [],
  }
}
