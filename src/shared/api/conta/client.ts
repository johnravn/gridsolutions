/**
 * Conta API Client
 *
 * This client fetches the API key from the database (company_expansions table)
 * on a per-company basis. The API key is stored encrypted in the database.
 */

import { supabase } from '../supabase'

// Get API base URL from environment
const contaApiUrlProd =
  import.meta.env.VITE_CONTA_API_URL_PROD ||
  import.meta.env.VITE_CONTA_API_URL ||
  'https://api.gateway.conta.no'
const contaApiUrlSandbox =
  import.meta.env.VITE_CONTA_API_URL_SANDBOX ||
  'https://api.gateway.conta-sandbox.no'

/** When true in local dev, use production Conta API key and URL regardless of company setting */
const useProductionInDev =
  import.meta.env.DEV &&
  import.meta.env.VITE_CONTA_USE_PRODUCTION_IN_DEV === 'true'

/**
 * Get the selected Conta API environment for the current user's company
 */
async function getAccountingEnvironment(): Promise<'production' | 'sandbox'> {
  const { data, error } = await supabase.rpc('get_accounting_api_environment')
  if (error) return 'production'
  return data === 'sandbox' ? 'sandbox' : 'production'
}

/**
 * Get the Conta API key for the current user's company
 * The key is stored encrypted in company_expansions table and decrypted server-side.
 * When VITE_CONTA_USE_PRODUCTION_IN_DEV=true in local dev, tries production key first
 * only if the company is not on sandbox — otherwise every request would call
 * get_conta_api_key(true), fail with no production key, then fall back (noisy 400s in
 * the browser). If the DB doesn't support p_force_production yet (migration not applied),
 * we fall back to company env so key and URL always match.
 */
async function getContaApiKey(): Promise<{
  key: string
  forceProductionUsed: boolean
}> {
  if (useProductionInDev) {
    const accountingEnv = await getAccountingEnvironment()
    if (accountingEnv === 'production') {
      const { data, error } = await supabase.rpc('get_conta_api_key', {
        p_force_production: true,
      })
      if (!error && data) {
        return { key: data, forceProductionUsed: true }
      }
    }
    // Sandbox company, migration not applied, or no production key: use company env
  }
  const { data, error } = await supabase.rpc('get_conta_api_key', {})
  if (error) throw error
  return { key: data, forceProductionUsed: false }
}

/**
 * Effective Conta API environment for the current company (same logic as
 * {@link contaRequest} base URL). Use for UI instead of guessing from env vars.
 */
export async function getEffectiveContaApiEnvironment(): Promise<
  'production' | 'sandbox'
> {
  const { forceProductionUsed } = await getContaApiKey()
  if (forceProductionUsed) return 'production'
  return getAccountingEnvironment()
}

/**
 * Get the read-only setting for the Conta API
 * Returns true if API should only allow read operations
 */
async function getAccountingReadOnly(): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_accounting_read_only')
  if (error) return true // Default to read-only on error
  return data
}

/**
 * Basic fetch wrapper for Conta API
 * Fetches the API key from the database for the given company
 *
 * Note: Types are generated from the OpenAPI spec in types.ts
 */
export async function contaRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const { key: apiKey, forceProductionUsed } = await getContaApiKey()
  if (!apiKey) {
    throw new Error('No Conta API key configured for this company')
  }

  const environment = forceProductionUsed
    ? 'production'
    : await getAccountingEnvironment()
  const baseUrl =
    environment === 'sandbox' ? contaApiUrlSandbox : contaApiUrlProd
  const url = `${baseUrl}${endpoint}`
  const hasBody = options.body !== undefined && options.body !== null
  const normalizedHeaders = new Headers(options.headers || {})

  if (hasBody && !normalizedHeaders.has('Content-Type')) {
    normalizedHeaders.set('Content-Type', 'application/json')
  }
  if (!normalizedHeaders.has('Accept')) {
    normalizedHeaders.set('Accept', 'application/json')
  }
  normalizedHeaders.set('apiKey', apiKey)

  return fetch(url, {
    ...options,
    headers: {
      ...Object.fromEntries(normalizedHeaders.entries()),
    },
  })
}

/**
 * Build a user-facing error string from a Conta error JSON body (or unknown parse result).
 * Used after reading the response body once (e.g. POST handlers that also inspect payload).
 */
export function formatContaApiError(
  status: number,
  statusText: string,
  errorData: unknown,
  rawBodyText: string,
): string {
  let errorMessage = `HTTP ${status}: ${statusText}`
  if (errorData && typeof errorData === 'object') {
    const ed = errorData as Record<string, unknown>
    const fromMessage =
      (typeof ed.message === 'string' && ed.message) ||
      (typeof ed.error === 'string' && ed.error) ||
      ''
    if (fromMessage) {
      errorMessage = fromMessage
    }
    if (typeof ed.hint === 'string' && ed.hint) {
      errorMessage += ` - ${ed.hint}`
    }
    const messages = ed.messages as Record<string, unknown> | undefined
    if (messages && (messages.EN || messages.NO)) {
      const m =
        (typeof messages.EN === 'string' && messages.EN) ||
        (typeof messages.NO === 'string' && messages.NO) ||
        ''
      if (m) {
        errorMessage = m
      }
    }
    if (Array.isArray(ed.errors) && ed.errors.length > 0) {
      const firstError = ed.errors[0] as Record<string, unknown> | undefined
      const feMessages = firstError?.messages as
        | Record<string, unknown>
        | undefined
      const detail =
        (feMessages &&
          ((typeof feMessages.EN === 'string' && feMessages.EN) ||
            (typeof feMessages.NO === 'string' && feMessages.NO))) ||
        firstError?.id
      if (detail) {
        errorMessage = `${errorMessage} - ${String(detail)}`
      }
    }
  } else if (rawBodyText) {
    errorMessage = rawBodyText
  }

  if (status === 401) {
    errorMessage +=
      ' Use a production key with https://api.gateway.conta.no and a sandbox key with https://api.gateway.conta-sandbox.no. In local dev with production key, set VITE_CONTA_USE_PRODUCTION_IN_DEV=true and VITE_CONTA_API_URL_PROD=https://api.gateway.conta.no in .env.local (not .env.local.db), then run: npm run db:reset.'
  }

  return errorMessage
}

async function buildContaErrorMessage(response: Response): Promise<string> {
  const rawText = await response.text()
  let errorData: unknown = null
  if (rawText) {
    try {
      errorData = JSON.parse(rawText)
    } catch {
      errorData = null
    }
  }
  const parsedObject =
    errorData !== null &&
    typeof errorData === 'object' &&
    !Array.isArray(errorData)
  return formatContaApiError(
    response.status,
    response.statusText,
    parsedObject ? errorData : null,
    parsedObject ? '' : rawText,
  )
}

/**
 * POST with the same auth/read-only rules as {@link contaClient.post}, but returns the raw
 * {@link Response} so callers can read the body once (e.g. to recover an existing project id
 * from structured Conta conflict payloads).
 */
export async function contaPostForResponse(
  endpoint: string,
  data?: unknown,
): Promise<Response> {
  const readOnly = await getAccountingReadOnly()
  if (readOnly) {
    throw new Error(
      'Write operations (POST) are not allowed when API is in read-only mode',
    )
  }
  return contaRequest(endpoint, {
    method: 'POST',
    body:
      data !== undefined && data !== null ? JSON.stringify(data) : undefined,
  })
}

/**
 * Placeholder typed client
 * This will be replaced with generated types from the OpenAPI spec
 *
 * Note: The client automatically uses the current user's selected company
 * from their profile to get the Conta API key and respects the read-only setting
 */
export const contaClient = {
  get: async (endpoint: string) => {
    const response = await contaRequest(endpoint, { method: 'GET' })

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      throw new Error(await buildContaErrorMessage(response))
    }

    return response.json()
  },
  post: async (endpoint: string, data?: unknown) => {
    const response = await contaPostForResponse(endpoint, data)

    if (!response.ok) {
      throw new Error(await buildContaErrorMessage(response))
    }

    return response.json()
  },
  put: async (endpoint: string, data?: unknown) => {
    // Check if read-only mode is enabled
    const readOnly = await getAccountingReadOnly()
    if (readOnly) {
      throw new Error(
        'Write operations (PUT) are not allowed when API is in read-only mode',
      )
    }
    const response = await contaRequest(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      throw new Error(await buildContaErrorMessage(response))
    }

    return response.json()
  },
  delete: async (endpoint: string) => {
    // Check if read-only mode is enabled
    const readOnly = await getAccountingReadOnly()
    if (readOnly) {
      throw new Error(
        'Write operations (DELETE) are not allowed when API is in read-only mode',
      )
    }
    const response = await contaRequest(endpoint, { method: 'DELETE' })

    if (!response.ok) {
      throw new Error(await buildContaErrorMessage(response))
    }

    return response.json()
  },
}
