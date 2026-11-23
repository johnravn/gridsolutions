import {
  
  buildCrewExpenseSuggestions,
  computeCrewBookingRateAmount
} from './moneySuggestions'
import type {CompanyGeneralRates} from './moneySuggestions';
import type { JobMoneyItemInsert } from '../api/moneyQueries'

export type AutofillFixedLine = {
  /** Stable key within a template run (used in source_id). */
  key: string
  type: 'income' | 'expense'
  description: string
  amount: number
}

export type AutofillCrewBooking = {
  id: string
  job_id: string
  user_name: string
  role: string | null
  rate: number | null
  rate_type: string | null
  vat_number: string | null
  start_at: string | null
  end_at: string | null
}

export type AutofillExistingMoneyItem = {
  id: string
  job_id: string
  source_id: string | null
}

export type AutofillPreviewLine = {
  job_id: string
  description: string
  type: 'income' | 'expense'
  amount: number
  date: string | null
  source: 'manual' | 'crew'
  source_id: string
  category: 'crew' | 'other' | null
  action: 'insert' | 'skip' | 'replace'
  existing_item_id?: string
}

export type AutofillPreview = {
  lines: Array<AutofillPreviewLine>
  insertCount: number
  skipCount: number
  replaceCount: number
}

/** Stable source_id for a fixed template line applied to a job. */
export function fixedAutofillSourceId(lineKey: string): string {
  return `series-autofill-fixed-${lineKey}`
}

export function buildFixedAutofillPreview(input: {
  jobIds: ReadonlyArray<string>
  jobDates: ReadonlyMap<string, string | null>
  lines: ReadonlyArray<AutofillFixedLine>
  existingItems: ReadonlyArray<AutofillExistingMoneyItem>
  replaceMatching: boolean
}): AutofillPreview {
  const existingByJobSource = new Map<string, AutofillExistingMoneyItem>()
  for (const item of input.existingItems) {
    if (!item.source_id) continue
    existingByJobSource.set(`${item.job_id}::${item.source_id}`, item)
  }

  const lines: Array<AutofillPreviewLine> = []
  for (const jobId of input.jobIds) {
    const date = input.jobDates.get(jobId) ?? null
    for (const line of input.lines) {
      if (!line.description.trim() || !(line.amount > 0)) continue
      const source_id = fixedAutofillSourceId(line.key)
      const existing = existingByJobSource.get(`${jobId}::${source_id}`)
      let action: AutofillPreviewLine['action'] = 'insert'
      if (existing) {
        action = input.replaceMatching ? 'replace' : 'skip'
      }
      lines.push({
        job_id: jobId,
        description: line.description.trim(),
        type: line.type,
        amount: line.amount,
        date,
        source: 'manual',
        source_id,
        category: 'other',
        action,
        existing_item_id: existing?.id,
      })
    }
  }

  return summarizePreview(lines)
}

export function buildCrewRateAutofillPreview(input: {
  jobIds: ReadonlyArray<string>
  bookings: ReadonlyArray<AutofillCrewBooking>
  companyRates: CompanyGeneralRates | null | undefined
  billingUnit: 'hour' | 'day'
  existingItems: ReadonlyArray<AutofillExistingMoneyItem>
  replaceMatching: boolean
}): AutofillPreview {
  const existingByJobSource = new Map<string, AutofillExistingMoneyItem>()
  for (const item of input.existingItems) {
    if (!item.source_id) continue
    existingByJobSource.set(`${item.job_id}::${item.source_id}`, item)
  }

  const jobIdSet = new Set(input.jobIds)
  const lines: Array<AutofillPreviewLine> = []

  for (const jobId of input.jobIds) {
    const jobBookings = input.bookings.filter(
      (b) => b.job_id === jobId && jobIdSet.has(b.job_id),
    )
    const withRates = jobBookings.map((booking) => ({
      id: booking.id,
      user_name: booking.user_name,
      role: booking.role,
      vat_number: booking.vat_number,
      rateAmount: computeCrewBookingRateAmount({
        role: booking.role,
        rate: booking.rate,
        rate_type: booking.rate_type,
        start_at: booking.start_at,
        end_at: booking.end_at,
        billingUnit: input.billingUnit,
        companyRates: input.companyRates,
      }),
      start_at: booking.start_at,
    }))

    // Empty Conta lines → rate-based crew expenses only (series autofill v1).
    const suggestions = buildCrewExpenseSuggestions({
      bookings: withRates,
      contaLines: [],
    })

    for (const suggestion of suggestions) {
      const existing = existingByJobSource.get(
        `${jobId}::${suggestion.sourceId}`,
      )
      let action: AutofillPreviewLine['action'] = 'insert'
      if (existing) {
        action = input.replaceMatching ? 'replace' : 'skip'
      }
      lines.push({
        job_id: jobId,
        description: suggestion.description,
        type: 'expense',
        amount: suggestion.amount,
        date: suggestion.date,
        source: 'crew',
        source_id: suggestion.sourceId,
        category: 'crew',
        action,
        existing_item_id: existing?.id,
      })
    }
  }

  return summarizePreview(lines)
}

export function previewLinesToInserts(
  lines: ReadonlyArray<AutofillPreviewLine>,
  companyId: string,
): {
  deletes: Array<string>
  inserts: Array<JobMoneyItemInsert>
} {
  const deletes: Array<string> = []
  const inserts: Array<JobMoneyItemInsert> = []

  for (const line of lines) {
    if (line.action === 'skip') continue
    if (line.action === 'replace' && line.existing_item_id) {
      deletes.push(line.existing_item_id)
    }
    inserts.push({
      job_id: line.job_id,
      company_id: companyId,
      type: line.type,
      description: line.description,
      amount: line.amount,
      date: line.date,
      reference: null,
      source: line.source,
      source_id: line.source_id,
      category: line.category,
    })
  }

  return { deletes, inserts }
}

function summarizePreview(lines: Array<AutofillPreviewLine>): AutofillPreview {
  let insertCount = 0
  let skipCount = 0
  let replaceCount = 0
  for (const line of lines) {
    if (line.action === 'insert') insertCount += 1
    else if (line.action === 'skip') skipCount += 1
    else replaceCount += 1
  }
  return { lines, insertCount, skipCount, replaceCount }
}
