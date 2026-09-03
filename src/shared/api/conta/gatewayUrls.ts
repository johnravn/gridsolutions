const DEFAULT_PROD = 'https://api.gateway.conta.no'
const DEFAULT_SANDBOX = 'https://api.gateway.conta-sandbox.no'

export function isContaSandboxUrl(url: string | undefined): boolean {
  return Boolean(url && /conta-sandbox/i.test(url))
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
