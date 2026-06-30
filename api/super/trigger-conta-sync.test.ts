import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRunSync = vi.fn()
const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../src/shared/conta/contaCustomerSyncCron', () => ({
  runContaCustomerSyncForAllCompanies: (...args: Array<unknown>) =>
    mockRunSync(...args),
}))

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

describe('trigger-conta-sync handler', () => {
  beforeEach(() => {
    mockRunSync.mockReset()
    mockGetUser.mockReset()
    mockFrom.mockReset()
    process.env.VITE_SUPABASE_URL = 'http://localhost:54321'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('returns 405 for non-POST methods', async () => {
    const handler = (await import('./trigger-conta-sync')).default
    const res = createMockRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.getStatus()).toBe(405)
  })

  it('returns 401 without authorization header', async () => {
    const handler = (await import('./trigger-conta-sync')).default
    const res = createMockRes()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.getStatus()).toBe(401)
  })

  it('returns 403 for non-superuser', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { superuser: false },
            error: null,
          }),
        }),
      }),
    })

    const handler = (await import('./trigger-conta-sync')).default
    const res = createMockRes()
    await handler(
      { method: 'POST', headers: { authorization: 'Bearer token' } },
      res,
    )
    expect(res.getStatus()).toBe(403)
  })
})
