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
