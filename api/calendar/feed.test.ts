import { describe, expect, it } from 'vitest'
import handler from './feed'

function createMockRes() {
  const headers: Record<string, string> = {}
  let status = 200
  let body = ''

  const res = {
    setHeader: (key: string, value: string) => {
      headers[key] = value
    },
    get statusCode() {
      return status
    },
    set statusCode(value: number) {
      status = value
    },
    end: (chunk?: string) => {
      if (chunk !== undefined) body = chunk
    },
  }

  return {
    res,
    getBody: () => body,
    getStatus: () => status,
    getHeaders: () => headers,
  }
}

describe('calendar feed handler', () => {
  it('returns 400 when token is missing', async () => {
    const { res, getBody, getStatus } = createMockRes()
    await handler({ method: 'GET', query: {} }, res)
    expect(getStatus()).toBe(400)
    expect(JSON.parse(getBody()).error).toBe('Missing token')
  })

  it('returns 405 for unsupported methods', async () => {
    const { res, getStatus } = createMockRes()
    await handler({ method: 'POST', query: { token: 'abc' } }, res)
    expect(getStatus()).toBe(405)
  })

  it('returns 204 for OPTIONS preflight', async () => {
    const { res, getStatus, getBody } = createMockRes()
    await handler({ method: 'OPTIONS', query: {} }, res)
    expect(getStatus()).toBe(204)
    expect(getBody()).toBe('')
  })

  it('returns 500 when Supabase env is missing', async () => {
    const originalUrl = process.env.VITE_SUPABASE_URL
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.VITE_SUPABASE_URL
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const { res, getBody, getStatus } = createMockRes()
    await handler({ method: 'GET', query: { token: 'abc' } }, res)
    expect(getStatus()).toBe(500)
    expect(JSON.parse(getBody()).error).toBe('Server configuration error')

    if (originalUrl) process.env.VITE_SUPABASE_URL = originalUrl
    if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  })
})
