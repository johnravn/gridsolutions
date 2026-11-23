const DEFAULT_PROD = 'https://api.gateway.conta.no'
const DEFAULT_SANDBOX = 'https://api.gateway.conta-sandbox.no'
const APP_PROD = 'https://app.conta.no'
const APP_SANDBOX = 'https://app.conta-sandbox.no'

export function isContaSandboxUrl(url: string | undefined): boolean {
  return Boolean(url && /conta-sandbox|conta.*test/i.test(url))
}

/**
 * Production and sandbox Conta gateway URLs.
 * Never use a sandbox host as the production URL (legacy VITE_CONTA_API_URL).
 */
export function resolveContaGatewayUrls(env: {
  prod?: string
  sandbox?: string
  fallback?: string
}): { prod: string; sandbox: string } {
  const sandbox = env.sandbox || DEFAULT_SANDBOX
  const fallback = env.fallback
  const prod =
    env.prod ||
    (fallback && !isContaSandboxUrl(fallback) ? fallback : undefined) ||
    DEFAULT_PROD
  return { prod, sandbox }
}

/** Conta web-app base for deep links (invoice UI), derived from gateway URL. */
export function contaAppBaseUrl(gatewayUrl: string | undefined): string {
  return isContaSandboxUrl(gatewayUrl) ? APP_SANDBOX : APP_PROD
}

/** Deep link into Conta’s invoice UI for an organization invoice. */
export function getContaInvoiceAppUrl(
  organizationId: string,
  invoiceId: string | null | undefined,
  gatewayUrl?: string,
): string | null {
  if (!invoiceId) return null
  const appBase = contaAppBaseUrl(gatewayUrl)
  return `${appBase}/faktura/${organizationId}/fakturaer/${invoiceId}`
}

/** Conta `transactionSourceType` values that are received EHFs. */
export function isContaEhfTransactionSource(
  sourceType?: string | null,
): boolean {
  return (
    sourceType === 'EHF_RECEIVED' ||
    sourceType === 'EHF_AUTOMATICALLY_PROCESSED'
  )
}

/** Options for Conta bilagsjournal deep links. */
export type ContaBilagsjournalLinkOptions = {
  /**
   * Ledger / invoice date (`YYYY-MM-DD`). When `fromDate`/`toDate` are omitted,
   * the calendar year of this date is used (`YYYY-01-01` … `YYYY-12-31`).
   */
  date?: string | null
  /** Explicit from date (`YYYY-MM-DD`). */
  fromDate?: string | null
  /** Explicit to date (`YYYY-MM-DD`). */
  toDate?: string | null
  gatewayUrl?: string
}

/** Extract a 4-digit year from an ISO date string (`YYYY-MM-DD` or prefix). */
export function yearFromContaDate(
  date: string | null | undefined,
): number | null {
  if (!date) return null
  const match = /^(\d{4})/.exec(date.trim())
  if (!match) return null
  const year = Number(match[1])
  return Number.isFinite(year) ? year : null
}

/**
 * Resolve bilagsjournal `fraDato` / `tilDato`.
 * Prefers explicit from/to; otherwise uses the calendar year of `date`.
 */
export function resolveContaBilagsjournalDateRange(
  options: Pick<
    ContaBilagsjournalLinkOptions,
    'date' | 'fromDate' | 'toDate'
  > = {},
): { fromDate: string; toDate: string } | null {
  const from = options.fromDate?.trim() || null
  const to = options.toDate?.trim() || null
  if (from && to) return { fromDate: from, toDate: to }

  const year = yearFromContaDate(options.date ?? from ?? to)
  if (year == null) return null
  return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` }
}

/**
 * Deep link into Conta’s bilagsjournal focused on one bilag (voucher) number.
 *
 * Conta field mapping:
 * - **bilag number** → API `transactionNo` (shown as Bilag in Conta UI)
 * - **transactionId** → internal id used by `/bilag/{id}/rediger/{kind}` — do **not**
 *   use that for “Open in Conta” on Accounting suggestions
 *
 * Pattern:
 * `/regnskap/{orgId}/rapporter/bilagsjournal?fraBilag={n}&fraDato=…&tilBilag={n}&tilDato=…`
 */
export function getContaTransactionAppUrl(
  organizationId: string,
  bilagNo: number | string | null | undefined,
  options?: ContaBilagsjournalLinkOptions,
): string | null {
  if (bilagNo == null || bilagNo === '') return null
  const range = resolveContaBilagsjournalDateRange(options)
  if (!range) return null

  const appBase = contaAppBaseUrl(options?.gatewayUrl)
  const params = new URLSearchParams({
    fraBilag: String(bilagNo),
    fraDato: range.fromDate,
    tilBilag: String(bilagNo),
    tilDato: range.toDate,
  })
  return `${appBase}/regnskap/${organizationId}/rapporter/bilagsjournal?${params.toString()}`
}
