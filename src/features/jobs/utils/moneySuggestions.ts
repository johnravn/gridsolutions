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
