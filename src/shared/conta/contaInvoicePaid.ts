/**
 * Conta invoice paid-status helpers.
 * Safe for Vercel serverless and the browser (no path aliases).
 */

export type ContaInvoiceStatusFields = {
  status?: string | null
  extendedStatus?: string | null
}

const PAID_STATUSES = new Set(['CLOSED_BY_PAYMENT', 'CLOSED_BY_EASYBANK'])

const PAID_EXTENDED_STATUSES = new Set([
  'PAID',
  'PAID_IN_CASH',
  'CLOSED_BY_EASYBANK',
])

/** True when Conta considers the invoice paid/settled via payment (not credit/write-off). */
export function isContaInvoicePaid(
  contaInvoice: ContaInvoiceStatusFields | null | undefined,
): boolean {
  if (!contaInvoice) return false
  const status = contaInvoice.status ?? undefined
  const extendedStatus = contaInvoice.extendedStatus ?? undefined
  if (status && PAID_STATUSES.has(status)) return true
  if (extendedStatus && PAID_EXTENDED_STATUSES.has(extendedStatus)) return true
  return false
}
