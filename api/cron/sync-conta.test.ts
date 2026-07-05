import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRunSync = vi.fn()

vi.mock('../../src/shared/conta/contaCustomerSyncCron', () => ({
  runContaCustomerSyncForAllCompanies: (...args: Array<unknown>) =>
    mockRunSync(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}))

function createMockRes() {
  const headers: Record<string, string> = {}
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

describe('sync-conta cron handler', () => {
  beforeEach(() => {
    mockRunSync.mockReset()
    process.env.CRON_SECRET = 'test-secret'
    process.env.VITE_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('returns 405 for non-GET methods', async () => {
    const handler = (await import('./sync-conta')).default
    const res = createMockRes()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.getStatus()).toBe(405)
  })

  it('returns 401 without valid cron secret', async () => {
    const handler = (await import('./sync-conta')).default
    const res = createMockRes()
    await handler(
      { method: 'GET', headers: { authorization: 'Bearer wrong' } },
      res,
    )
    expect(res.getStatus()).toBe(401)
  })

  it('runs sync with valid cron secret', async () => {
    mockRunSync.mockResolvedValue({
      ok: true,
      runId: 'run-1',
      status: 'success',
      companies: 1,
      syncedAt: '2026-01-01',
      results: [{ companyId: 'c1' }],
      error: null,
    })

    const handler = (await import('./sync-conta')).default
    const res = createMockRes()
    await handler(
      {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret' },
      },
      res,
    )

    expect(res.getStatus()).toBe(200)
    expect(mockRunSync).toHaveBeenCalled()
    expect(res.getBody()).toMatchObject({ ok: true })
  })
})
