import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockFetch = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

function createMockRes() {
  let status = 200
  let body: unknown = null
  const res = {
    status: (code: number) => {
      status = code
      return res
    },
    json: (data: unknown) => {
      body = data
    },
    getStatus: () => status,
    getBody: () => body,
  }
  return res
}

describe('trigger-email-dispatch handler', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockFrom.mockReset()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    process.env.VITE_SUPABASE_URL = 'http://localhost:54321'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.CRON_SECRET = 'test-cron-secret'
    vi.resetModules()
  })

  it('returns 405 for non-POST methods', async () => {
    const handler = (await import('../super/trigger-email-dispatch')).default
    const res = createMockRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.getStatus()).toBe(405)
  })

  it('returns 401 without authorization', async () => {
    const handler = (await import('../super/trigger-email-dispatch')).default
    const res = createMockRes()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.getStatus()).toBe(401)
  })

  it('invokes dispatch edge function for superuser', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { superuser: true },
            error: null,
          }),
        }),
      }),
    })
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        runId: 'run-1',
        scanned: 2,
        attempted: 2,
        sentOrProcessed: 2,
        errors: 0,
      }),
    })

    const handler = (await import('../super/trigger-email-dispatch')).default
    const res = createMockRes()
    await handler(
      { method: 'POST', headers: { authorization: 'Bearer token' } },
      res,
    )

    expect(res.getStatus()).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:54321/functions/v1/dispatch-notification-emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-cron-secret',
          'x-trigger-source': 'manual',
        }),
      }),
    )
    expect(res.getBody()).toMatchObject({
      ok: true,
      scanned: 2,
      errors: 0,
    })
  })

  it('returns 500 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { superuser: true },
            error: null,
          }),
        }),
      }),
    })

    const handler = (await import('../super/trigger-email-dispatch')).default
    const res = createMockRes()
    await handler(
      { method: 'POST', headers: { authorization: 'Bearer token' } },
      res,
    )

    expect(res.getStatus()).toBe(500)
    expect(res.getBody()).toMatchObject({ error: 'Missing CRON_SECRET' })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
