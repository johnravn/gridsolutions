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

/**
 * Conta bilag “rediger” path kind — Conta has no `/bilag/{id}` detail route.
 * Real routes are `/regnskap/{org}/bilag/{transactionId}/rediger/{kind}`.
 */
export type ContaBilagEditKind =
  | 'ehf'
  | 'kjop'
  | 'inntekt'
  | 'avansert'
  | 'proff'

/** Conta `transactionSourceType` values that are received EHFs. */
export function isContaEhfTransactionSource(
  sourceType?: string | null,
): boolean {
  return (
    sourceType === 'EHF_RECEIVED' ||
    sourceType === 'EHF_AUTOMATICALLY_PROCESSED'
  )
}

/** Map Conta ledger/transaction source type → bilag edit route kind. */
export function contaBilagEditKindFromSourceType(
  sourceType?: string | null,
): ContaBilagEditKind {
  if (isContaEhfTransactionSource(sourceType)) return 'ehf'
  switch (sourceType) {
    case 'REGISTER_INCOME':
      return 'inntekt'
    case 'PRO_TRANSACTION':
      return 'proff'
    case 'ADVANCED_TRANSACTION':
    case 'BULK_TRANSACTION':
      return 'avansert'
    case 'REGISTER_PURCHASE':
    case 'CREDIT_CARD_PURCHASE':
      return 'kjop'
    default:
      // Supplier-ledger / received-invoice suggestions → purchase bilag.
      return 'kjop'
  }
}

/**
 * Deep link into Conta bookkeeping voucher (bilag) for a transaction.
 * Used for supplier / received-invoice ledger lines.
 *
 * Conta does **not** serve `/regnskap/{org}/bilag/{id}` (that 404s). The working
 * pattern is `/regnskap/{org}/bilag/{transactionId}/rediger/{kind}`.
 */
export function getContaTransactionAppUrl(
  organizationId: string,
  transactionId: number | string | null | undefined,
  gatewayUrl?: string,
  sourceType?: string | null,
): string | null {
  if (transactionId == null || transactionId === '') return null
  const appBase = contaAppBaseUrl(gatewayUrl)
  const kind = contaBilagEditKindFromSourceType(sourceType)
  return `${appBase}/regnskap/${organizationId}/bilag/${transactionId}/rediger/${kind}`
}
