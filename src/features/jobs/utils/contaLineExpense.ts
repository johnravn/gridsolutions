import type { ContaInvoiceDisplayLine } from './contaInvoiceDisplay'

/** Stable money-item source_id for a Conta sales-invoice line → expense. */
export function contaLineExpenseSourceId(
  jobInvoiceId: string,
  lineNo: number | null | undefined,
  lineIndex: number,
): string {
  const lineKey =
    lineNo != null && Number.isFinite(lineNo) ? String(lineNo) : `i${lineIndex}`
  return `conta-sales-line-${jobInvoiceId}-${lineKey}`
}

/** Description for Conta line → expense (pass-through costs). */
export function contaLineExpenseDescription(
  line: Pick<ContaInvoiceDisplayLine, 'description'>,
): string {
  const text = line.description?.trim()
  return text && text.length > 0 ? text : 'Conta line'
}

/**
 * Amount for Conta line → expense: line net (ex VAT).
 * Returns null when net is missing or not a positive finite number.
 */
export function computeContaLineExpenseAmount(
  line: Pick<ContaInvoiceDisplayLine, 'sumNet'>,
): number | null {
  const amount = line.sumNet
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null
  }
  return Math.round(amount * 100) / 100
}

/** Prefer Conta invoice date (YYYY-MM-DD); otherwise null. */
export function contaLineExpenseDate(
  invoiceDate: string | null | undefined,
): string | null {
  if (!invoiceDate) return null
  const trimmed = invoiceDate.trim()
  // Conta often sends YYYY-MM-DD; also accept ISO datetimes.
  const day = trimmed.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day
  return null
}

export function contaLineExpenseReference(input: {
  invoiceNo: string | null | undefined
  lineNo: number | null | undefined
  lineIndex: number
}): string {
  const lineLabel =
    input.lineNo != null && Number.isFinite(input.lineNo)
      ? String(input.lineNo)
      : String(input.lineIndex + 1)
  const inv = input.invoiceNo?.trim()
  if (inv) return `#${inv} L${lineLabel}`
  return `L${lineLabel}`
}
