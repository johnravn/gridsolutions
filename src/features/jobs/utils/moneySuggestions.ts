import { normalizeOrgNo } from '@shared/conta/contaCustomerMatch'
import { roundMoney } from './offerCalculations'
import {
  contaExpenseConfidence,
  contaExpenseConfidenceReason,
  contaIncomeConfidence,
  contaIncomeConfidenceReason,
} from './moneyConta'
import type { ContaExpenseMatchMode, ContaMatchConfidence } from './moneyConta'
import type {
  JobMoneyItemCategory,
  JobMoneyItemSource,
} from '../api/moneyQueries'

export type MoneySuggestionType = 'income' | 'expense'

export type MoneySuggestion = {
  id: string
  sourceId: string
  type: MoneySuggestionType
  description: string
  amount: number
  date: string | null
  reference?: string
  source: JobMoneyItemSource
  category: JobMoneyItemCategory | null
  /** Conta (and related) match confidence for review UX */
  confidence?: ContaMatchConfidence | null
  confidenceReason?: string | null
  /** Optional deep link (e.g. Conta invoice / bilag). */
  externalUrl?: string | null
}

export const DEFAULT_TRANSPORT_COST_PER_KM = 5

/** Conta invoice statuses that count as real sales income for Money suggestions. */
export const MONEY_INVOICE_INCOME_STATUSES = ['created', 'paid'] as const

export type MoneyInvoiceIncomeStatus =
  (typeof MONEY_INVOICE_INCOME_STATUSES)[number]

export function isMoneyInvoiceIncomeStatus(
  status: string,
): status is MoneyInvoiceIncomeStatus {
  return (MONEY_INVOICE_INCOME_STATUSES as ReadonlyArray<string>).includes(
    status,
  )
}

/**
 * Sum invoice lines ex VAT (price × qty × (1 − discount/100)).
 * Matches InvoiceHistory line math without adding VAT.
 */
export function invoiceLinesExVatTotal(invoiceLines: unknown): number | null {
  if (!Array.isArray(invoiceLines) || invoiceLines.length === 0) return null
  let total = 0
  for (const line of invoiceLines) {
    if (!line || typeof line !== 'object') continue
    const row = line as Record<string, unknown>
    const price = Number(row.price) || 0
    const qty = Number(row.quantity) || 0
    const discount = Number(row.discount) || 0
    total += price * qty * (1 - discount / 100)
  }
  return roundMoney(total)
}

/** Prefer invoice_data.invoiceLines ex VAT; optional Conta response net fields. */
export function jobInvoiceExVatAmount(invoice: {
  invoice_data?: unknown
  conta_response?: unknown
}): number | null {
  const data = invoice.invoice_data
  if (data && typeof data === 'object') {
    const lines = (data as { invoiceLines?: unknown }).invoiceLines
    const fromLines = invoiceLinesExVatTotal(lines)
    if (fromLines != null && fromLines > 0) return fromLines
  }

  const resp = invoice.conta_response
  if (resp && typeof resp === 'object') {
    const r = resp as Record<string, unknown>
    for (const key of [
      // Conta RouteV1InvoiceModel / draft uses sumNet
      'sumNet',
      'netAmount',
      'amountExVat',
      'sumExVat',
      'totalExVat',
    ] as const) {
      const v = r[key]
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        return roundMoney(v)
      }
    }
  }

  return null
}

export function transportCostAmount(
  kmDriven: number | null | undefined,
  costPerKm: number | null | undefined,
): number | null {
  if (kmDriven == null || !(kmDriven > 0)) return null
  const rate =
    costPerKm != null && Number.isFinite(costPerKm) && costPerKm >= 0
      ? costPerKm
      : DEFAULT_TRANSPORT_COST_PER_KM
  return roundMoney(kmDriven * rate)
}

export function buildTransportCostSuggestion(input: {
  kmDriven: number | null | undefined
  costPerKm: number | null | undefined
  date?: string | null
}): MoneySuggestion | null {
  const amount = transportCostAmount(input.kmDriven, input.costPerKm)
  if (amount == null || amount <= 0) return null
  const km = Number(input.kmDriven)
  const rate =
    input.costPerKm != null && Number.isFinite(input.costPerKm)
      ? Number(input.costPerKm)
      : DEFAULT_TRANSPORT_COST_PER_KM
  return {
    id: 'transport-km',
    sourceId: 'transport-km',
    type: 'expense',
    description: `Transport (${km} km × ${rate} kr/km)`,
    amount,
    date: input.date ?? null,
    reference: undefined,
    source: 'manual',
    category: 'transport',
  }
}

export type PrimaryIncomeOffer = {
  id: string
  offernr: number | null
  title: string | null
  version_number: number
  total_after_discount: number
  accepted_at: string | null
}

export type PrimaryIncomeInvoice = {
  id: string
  status: string
  created_at: string
  invoice_data?: unknown
  conta_response?: unknown
  conta_invoice_id?: string | null
}

/**
 * Primary income: Conta sales invoice net when present, else latest accepted offer ex VAT.
 * Returns null if neither yields a positive amount.
 */
export function buildPrimaryIncomeSuggestions(input: {
  invoices: Array<PrimaryIncomeInvoice>
  acceptedOffers: Array<PrimaryIncomeOffer>
  formatOfferLabel: (offer: PrimaryIncomeOffer) => string
}): Array<MoneySuggestion> {
  const invoiceSuggestions: Array<MoneySuggestion> = []
  for (const inv of input.invoices) {
    if (!isMoneyInvoiceIncomeStatus(inv.status)) continue
    const amount = jobInvoiceExVatAmount(inv)
    if (amount == null || amount <= 0) continue
    invoiceSuggestions.push({
      id: `invoice-${inv.id}`,
      sourceId: `invoice-${inv.id}`,
      type: 'income',
      description: inv.conta_invoice_id
        ? `Conta invoice ${inv.conta_invoice_id} (ex MVA)`
        : 'Conta sales invoice (ex MVA)',
      amount,
      date: inv.created_at,
      reference: inv.conta_invoice_id ?? undefined,
      source: 'conta',
      category: 'other',
      confidence: null,
      confidenceReason: null,
    })
  }

  if (invoiceSuggestions.length > 0) {
    const conf = contaIncomeConfidence(invoiceSuggestions.length)
    const reason = contaIncomeConfidenceReason(invoiceSuggestions.length)
    return invoiceSuggestions.map((s) => ({
      ...s,
      confidence: conf,
      confidenceReason: reason,
    }))
  }

  return input.acceptedOffers
    .filter((o) => Number(o.total_after_discount) > 0)
    .map((offer) => ({
      id: `offer-${offer.id}`,
      sourceId: `offer-${offer.id}`,
      type: 'income' as const,
      description: input.formatOfferLabel(offer),
      amount: roundMoney(Number(offer.total_after_discount)),
      date: offer.accepted_at,
      reference: undefined,
      source: 'offer' as const,
      category: 'other' as const,
      confidence: 'high' as const,
      confidenceReason: 'Accepted offer total (ex MVA)',
    }))
}

/** Build Conta supplier-ledger expense suggestions with match confidence. */
export function buildContaExpenseSuggestions(input: {
  lines: Array<{
    id?: number
    date?: string
    dueDate?: string
    description?: string
    amount?: number
    invoiceNo?: string
    bookkeepingAccountName?: string
    supplierName?: string
  }>
  matchMode: ContaExpenseMatchMode
}): Array<MoneySuggestion> {
  const confidence = contaExpenseConfidence(input.matchMode)
  const confidenceReason = contaExpenseConfidenceReason(input.matchMode)
  return input.lines
    .map((line) => {
      const amount = Number(line.amount ?? 0)
      if (!amount) return null
      const sourceId = `conta-${line.id ?? `${line.description}-${line.date}`}`
      return {
        id: sourceId,
        sourceId,
        type: 'expense' as const,
        description:
          line.description ||
          line.bookkeepingAccountName ||
          line.supplierName ||
          'Accounting expense',
        amount: Math.abs(amount),
        date: line.date || line.dueDate || null,
        reference: line.invoiceNo || undefined,
        source: 'conta' as const,
        category: 'conta' as const,
        confidence,
        confidenceReason,
      }
    })
    .filter((exp): exp is NonNullable<typeof exp> => exp !== null)
}

export type CrewBookingExpenseInput = {
  id: string
  user_name: string
  role: string | null
  vat_number: string | null
  /** Precomputed billing-rate amount; null when rate fallback unavailable. */
  rateAmount: number | null
  start_at: string | null
}

export type CrewContaInvoiceLineInput = {
  id?: number
  date?: string
  dueDate?: string
  description?: string
  amount?: number
  invoiceNo?: string
  invoiceId?: number
  transactionId?: number
  supplierOrgNo?: string
  supplierName?: string
  bookkeepingAccountName?: string
  externalUrl?: string | null
}

export type CompanyGeneralRates = {
  employee_hourly_rate?: number | null
  employee_daily_rate?: number | null
  owner_hourly_rate?: number | null
  owner_daily_rate?: number | null
}

/**
 * Billing-rate amount for one crew booking (Accounting expense fallback).
 *
 * Freelancers use personal rate/rate_type (default hourly when rate is set but
 * type is missing). They do **not** require company general rates. When a
 * freelancer has no personal rate, fall back to employee company rates.
 */
export function computeCrewBookingRateAmount(input: {
  role: string | null | undefined
  rate: number | null | undefined
  rate_type: string | null | undefined
  start_at: string | null | undefined
  end_at: string | null | undefined
  billingUnit: 'hour' | 'day'
  companyRates: CompanyGeneralRates | null | undefined
}): number | null {
  if (!input.start_at || !input.end_at) return null

  const start = new Date(input.start_at)
  const end = new Date(input.end_at)
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  if (!Number.isFinite(durationHours) || durationHours <= 0) return null
  const durationDays = durationHours / 24

  let rate: number | null = null
  let rateType: 'daily' | 'hourly' | null = null
  const role = input.role || null
  const companyRates = input.companyRates

  if (role === 'freelancer') {
    if (input.rate != null && Number(input.rate) > 0) {
      rate = Number(input.rate)
      rateType =
        input.rate_type === 'daily'
          ? 'daily'
          : input.rate_type === 'hourly'
            ? 'hourly'
            : 'hourly'
    } else if (companyRates) {
      const picked = pickCompanyRoleRate(
        companyRates,
        'employee',
        input.billingUnit,
      )
      rate = picked.rate
      rateType = picked.rateType
    }
  } else if (role === 'employee' || role === 'owner') {
    if (!companyRates) return null
    const picked = pickCompanyRoleRate(companyRates, role, input.billingUnit)
    rate = picked.rate
    rateType = picked.rateType
  }

  if (rate == null || rate <= 0 || !rateType) return null
  return rateType === 'daily'
    ? rate * Math.ceil(durationDays)
    : rate * durationHours
}

function pickCompanyRoleRate(
  companyRates: CompanyGeneralRates,
  role: 'employee' | 'owner',
  billingUnit: 'hour' | 'day',
): { rate: number | null; rateType: 'daily' | 'hourly' | null } {
  const hourly =
    role === 'employee'
      ? companyRates.employee_hourly_rate
      : companyRates.owner_hourly_rate
  const daily =
    role === 'employee'
      ? companyRates.employee_daily_rate
      : companyRates.owner_daily_rate

  const useHourly = billingUnit === 'hour' && hourly
  const useDaily = billingUnit === 'day' && daily
  if (useHourly) return { rate: Number(hourly), rateType: 'hourly' }
  if (useDaily) return { rate: Number(daily), rateType: 'daily' }
  if (daily) return { rate: Number(daily), rateType: 'daily' }
  if (hourly) return { rate: Number(hourly), rateType: 'hourly' }
  return { rate: null, rateType: null }
}

/**
 * Crew booking expenses (#174):
 * Priority 1 — Conta received invoices matching crew orgnr (show all).
 * Priority 2 — billing-rate fallback when no usable Conta suggestions.
 */
export function buildCrewExpenseSuggestions(input: {
  bookings: Array<CrewBookingExpenseInput>
  contaLines: Array<CrewContaInvoiceLineInput>
}): Array<MoneySuggestion> {
  const out: Array<MoneySuggestion> = []
  const linesByOrgNo = new Map<string, Array<CrewContaInvoiceLineInput>>()
  for (const line of input.contaLines) {
    const orgNo = normalizeOrgNo(line.supplierOrgNo)
    if (!orgNo) continue
    const bucket = linesByOrgNo.get(orgNo)
    if (bucket) bucket.push(line)
    else linesByOrgNo.set(orgNo, [line])
  }

  for (const booking of input.bookings) {
    const orgNo = normalizeOrgNo(booking.vat_number)
    const matches = orgNo.length > 0 ? (linesByOrgNo.get(orgNo) ?? []) : []

    let contaSuggestionCount = 0
    if (matches.length > 0) {
      for (const line of matches) {
        const amount = Math.abs(Number(line.amount ?? 0))
        if (!amount) continue
        const lineKey =
          line.id ??
          line.invoiceId ??
          line.transactionId ??
          `${line.invoiceNo ?? 'inv'}-${line.date ?? 'd'}`
        const sourceId = `crew-conta-${booking.id}-${lineKey}`
        const invoiceLabel = line.invoiceNo
          ? `Conta invoice ${line.invoiceNo}`
          : line.description ||
            line.supplierName ||
            line.bookkeepingAccountName ||
            'Conta received invoice'
        out.push({
          id: sourceId,
          sourceId,
          type: 'expense',
          description: `${booking.user_name}: ${invoiceLabel}`,
          amount,
          date: line.date || line.dueDate || booking.start_at,
          reference: line.invoiceNo || undefined,
          source: 'conta',
          category: 'crew',
          confidence: 'high',
          confidenceReason:
            matches.length === 1
              ? 'Conta received invoice matched crew org number'
              : `${matches.length} Conta received invoices matched crew org number — review all`,
          externalUrl: line.externalUrl ?? null,
        })
        contaSuggestionCount += 1
      }
      if (contaSuggestionCount > 0) continue
    }

    if (booking.rateAmount == null || booking.rateAmount <= 0) continue
    out.push({
      id: `crew-expense-${booking.id}`,
      sourceId: `crew-${booking.id}`,
      type: 'expense',
      description: `${booking.user_name} (${booking.role || 'unknown'})`,
      amount: roundMoney(booking.rateAmount),
      date: booking.start_at,
      reference: undefined,
      source: 'crew',
      category: 'crew',
      confidence: 'medium',
      confidenceReason: 'Crew billing rate (no Conta invoice match)',
    })
  }

  return out
}

/** Conta ledger line keys already suggested via crew orgnr matching. */
export function contaLedgerLineKey(line: {
  id?: number
  invoiceId?: number
  transactionId?: number
  invoiceNo?: string
  date?: string
}): string {
  if (line.id != null) return `id:${line.id}`
  if (line.invoiceId != null) return `invoice:${line.invoiceId}`
  if (line.transactionId != null) return `tx:${line.transactionId}`
  return `ref:${line.invoiceNo ?? ''}-${line.date ?? ''}`
}

/** Conta ledger line keys already suggested via crew orgnr matching. */
export function crewContaSuggestionLineKeys(
  lines: Array<
    Pick<
      CrewContaInvoiceLineInput,
      'id' | 'invoiceId' | 'transactionId' | 'invoiceNo' | 'date'
    >
  >,
): Set<string> {
  return new Set(lines.map((line) => contaLedgerLineKey(line)))
}

/** True when primary income from offer or Conta sales invoice exists (for crew-income suppress). */
export function hasPrimaryIncomeSource(input: {
  invoices: Array<
    Pick<PrimaryIncomeInvoice, 'status' | 'invoice_data' | 'conta_response'>
  >
  acceptedOffers: Array<Pick<PrimaryIncomeOffer, 'total_after_discount'>>
}): boolean {
  for (const inv of input.invoices) {
    if (!isMoneyInvoiceIncomeStatus(inv.status)) continue
    const amount = jobInvoiceExVatAmount(inv)
    if (amount != null && amount > 0) return true
  }
  return input.acceptedOffers.some((o) => Number(o.total_after_discount) > 0)
}

export function categoryForSource(
  source: JobMoneyItemSource,
  type: MoneySuggestionType,
  explicit?: JobMoneyItemCategory | null,
): JobMoneyItemCategory | null {
  if (explicit) return explicit
  if (source === 'crew') return 'crew'
  if (source === 'conta' && type === 'expense') return 'conta'
  if (source === 'conta' && type === 'income') return 'other'
  if (source === 'offer') return 'other'
  return 'other'
}
