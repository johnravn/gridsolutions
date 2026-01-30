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
  import.meta.env.VITE_CONTA_API_URL ||
  'https://api.gateway.conta.no'

/**
 * Get the Conta API key for the current user's company
 * The key is stored encrypted in company_expansions table and decrypted server-side
 */
async function getContaApiKey(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_conta_api_key')

  if (error) throw error

  return data as string | null
}

/**
 * Get the selected Conta API environment for the current user's company
 */
async function getAccountingEnvironment(): Promise<'production' | 'sandbox'> {
  const { data, error } = await supabase.rpc('get_accounting_api_environment')
  if (error) return 'production'
  return data === 'sandbox' ? 'sandbox' : 'production'
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
  const apiKey = await getContaApiKey()
  if (!apiKey) {
    throw new Error('No Conta API key configured for this company')
  }

  const environment = await getAccountingEnvironment()
  const baseUrl =
    environment === 'sandbox' ? contaApiUrlSandbox : contaApiUrlProd
  const url = `${baseUrl}${endpoint}`
  const method = (options.method || 'GET').toUpperCase()
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

async function buildContaErrorMessage(response: Response): Promise<string> {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`
  try {
    const errorData = await response.json()
    errorMessage = errorData.message || errorData.error || errorMessage
    if (errorData.hint) {
      errorMessage += ` - ${errorData.hint}`
    }
    if (errorData.messages?.EN || errorData.messages?.NO) {
      const message = errorData.messages?.EN || errorData.messages?.NO || ''
      if (message) {
        errorMessage = message
      }
    }
    if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
      const firstError = errorData.errors[0]
      const detail =
        firstError?.messages?.EN || firstError?.messages?.NO || firstError?.id
      if (detail) {
        errorMessage = `${errorMessage} - ${detail}`
      }
    }
  } catch (e) {
    try {
      const text = await response.clone().text()
      if (text) {
        errorMessage = text
      }
    } catch (innerError) {
      // If JSON parsing fails, use the status text
    }
  }

  if (response.status === 401) {
    errorMessage +=
      ' - Check that your API key matches the Conta environment (sandbox vs production) and that VITE_CONTA_API_URL is set correctly.'
  }

  return errorMessage
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
    // Check if read-only mode is enabled
    const readOnly = await getAccountingReadOnly()
    if (readOnly) {
      throw new Error(
        'Write operations (POST) are not allowed when API is in read-only mode',
      )
    }
    const response = await contaRequest(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })

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
