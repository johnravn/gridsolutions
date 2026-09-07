import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRunSync = vi.fn()
const mockRunInvoicePaidSync = vi.fn()

vi.mock('../../src/shared/conta/contaCustomerSyncCron', () => ({
  runContaCustomerSyncForAllCompanies: (...args: Array<unknown>) =>
    mockRunSync(...args),
}))

vi.mock('../../src/shared/conta/contaInvoicePaidSyncCron', () => ({
  runContaInvoicePaidSyncForAllCompanies: (...args: Array<unknown>) =>
    mockRunInvoicePaidSync(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
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

function mockSuccessfulSyncs() {
  mockRunSync.mockResolvedValue({
    ok: true,
    runId: 'run-1',
    status: 'success',
    companies: 1,
    syncedAt: '2026-01-01',
    results: [{ companyId: 'c1' }],
    error: null,
  })
  mockRunInvoicePaidSync.mockResolvedValue({
    ok: true,
    runId: 'run-2',
    status: 'success',
    companies: 1,
    syncedAt: '2026-01-01',
    results: [{ companyId: 'c1', checked: 0, invoicesMarkedPaid: 0 }],
    error: undefined,
  })
}

describe('sync-conta cron handler', () => {
  beforeEach(() => {
    mockRunSync.mockReset()
    mockRunInvoicePaidSync.mockReset()
    process.env.CRON_SECRET = 'test-secret'
    process.env.VITE_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('returns 405 for non-GET methods', async () => {
    const handler = (await import('../cron/sync-conta')).default
    const res = createMockRes()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.getStatus()).toBe(405)
  })

  it('returns 401 without valid cron secret', async () => {
    const handler = (await import('../cron/sync-conta')).default
    const res = createMockRes()
    await handler(
      { method: 'GET', headers: { authorization: 'Bearer wrong' } },
      res,
    )
    expect(res.getStatus()).toBe(401)
    expect(mockRunSync).not.toHaveBeenCalled()
  })

  it('returns 401 for a forged vercel-cron User-Agent without a bearer', async () => {
    const handler = (await import('../cron/sync-conta')).default
    const res = createMockRes()
    await handler(
      { method: 'GET', headers: { 'user-agent': 'vercel-cron/1.0' } },
      res,
    )
    expect(res.getStatus()).toBe(401)
    expect(mockRunSync).not.toHaveBeenCalled()
  })

  it('returns 401 for a forged vercel-cron User-Agent with the wrong bearer', async () => {
    const handler = (await import('../cron/sync-conta')).default
    const res = createMockRes()
    await handler(
      {
        method: 'GET',
        headers: {
          authorization: 'Bearer wrong',
          'user-agent': 'vercel-cron/1.0',
        },
      },
      res,
    )
    expect(res.getStatus()).toBe(401)
    expect(mockRunSync).not.toHaveBeenCalled()
  })

  it('returns 401 when CRON_SECRET is unset, even with a vercel-cron User-Agent', async () => {
    delete process.env.CRON_SECRET
    const handler = (await import('../cron/sync-conta')).default
    const res = createMockRes()
    await handler(
      { method: 'GET', headers: { 'user-agent': 'vercel-cron/1.0' } },
      res,
    )
    expect(res.getStatus()).toBe(401)
    expect(mockRunSync).not.toHaveBeenCalled()
  })

  it('runs customer and invoice paid sync with valid cron secret', async () => {
    mockSuccessfulSyncs()

    const handler = (await import('../cron/sync-conta')).default
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
    expect(mockRunInvoicePaidSync).toHaveBeenCalled()
    expect(mockRunSync).toHaveBeenCalledWith(expect.anything(), {
      triggerSource: 'manual',
    })
    expect(res.getBody()).toMatchObject({
      ok: true,
      customerSync: { ok: true, runId: 'run-1' },
      invoicePaidSync: { ok: true, runId: 'run-2' },
    })
  })

  it('treats vercel-cron User-Agent as a trigger source only when the bearer is valid', async () => {
    mockSuccessfulSyncs()

    const handler = (await import('../cron/sync-conta')).default
    const res = createMockRes()
    await handler(
      {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret',
          'user-agent': 'vercel-cron/1.0',
        },
      },
      res,
    )

    expect(res.getStatus()).toBe(200)
    expect(mockRunSync).toHaveBeenCalledWith(expect.anything(), {
      triggerSource: 'vercel_cron',
    })
    expect(mockRunInvoicePaidSync).toHaveBeenCalledWith(expect.anything(), {
      triggerSource: 'vercel_cron',
    })
  })

  it('preserves x-trigger-source github_actions when the bearer is valid', async () => {
    mockSuccessfulSyncs()

    const handler = (await import('../cron/sync-conta')).default
    const res = createMockRes()
    await handler(
      {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret',
          'x-trigger-source': 'github_actions',
        },
      },
      res,
    )

    expect(res.getStatus()).toBe(200)
    expect(mockRunSync).toHaveBeenCalledWith(expect.anything(), {
      triggerSource: 'github_actions',
    })
    expect(mockRunInvoicePaidSync).toHaveBeenCalledWith(expect.anything(), {
      triggerSource: 'github_actions',
    })
  })
})
