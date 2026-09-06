import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRunSync = vi.fn()
const mockRunInvoicePaidSync = vi.fn()
const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../src/shared/conta/contaCustomerSyncCron', () => ({
  runContaCustomerSyncForAllCompanies: (...args: Array<unknown>) =>
    mockRunSync(...args),
}))

vi.mock('../../src/shared/conta/contaInvoicePaidSyncCron', () => ({
  runContaInvoicePaidSyncForAllCompanies: (...args: Array<unknown>) =>
    mockRunInvoicePaidSync(...args),
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
    mockRunInvoicePaidSync.mockReset()
    mockGetUser.mockReset()
    mockFrom.mockReset()
    process.env.VITE_SUPABASE_URL = 'http://localhost:54321'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    vi.resetModules()
  })

  it('returns 405 for non-POST methods', async () => {
    const handler = (await import('../super/trigger-conta-sync')).default
    const res = createMockRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.getStatus()).toBe(405)
  })

  it('returns 401 without authorization header', async () => {
    const handler = (await import('../super/trigger-conta-sync')).default
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

    const handler = (await import('../super/trigger-conta-sync')).default
    const res = createMockRes()
    await handler(
      { method: 'POST', headers: { authorization: 'Bearer token' } },
      res,
    )
    expect(res.getStatus()).toBe(403)
  })

  it('runs customer + invoice paid sync and returns nested results', async () => {
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
    mockRunSync.mockResolvedValue({
      ok: true,
      runId: 'run-customer',
      status: 'success',
      companies: 1,
      syncedAt: '2026-09-04T12:00:00.000Z',
      results: [
        {
          companyId: 'c1',
          updated: 2,
          created: 1,
          skipped: 0,
          errors: [],
        },
      ],
    })
    mockRunInvoicePaidSync.mockResolvedValue({
      ok: true,
      runId: 'run-invoice',
      status: 'success',
      companies: 1,
      syncedAt: '2026-09-04T12:00:01.000Z',
      results: [
        {
          companyId: 'c1',
          checked: 3,
          invoicesMarkedPaid: 1,
          jobsMarkedPaid: 1,
          skipped: 0,
          errors: [],
        },
      ],
    })

    const handler = (await import('../super/trigger-conta-sync')).default
    const res = createMockRes()
    await handler(
      { method: 'POST', headers: { authorization: 'Bearer token' } },
      res,
    )

    expect(res.getStatus()).toBe(200)
    const body = res.getBody() as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.customerSync).toMatchObject({
      ok: true,
      runId: 'run-customer',
      status: 'success',
    })
    expect(body.invoicePaidSync).toMatchObject({
      ok: true,
      runId: 'run-invoice',
      status: 'success',
    })
    expect(body.runId).toBe('run-customer')
    expect(mockRunSync).toHaveBeenCalledOnce()
    expect(mockRunInvoicePaidSync).toHaveBeenCalledOnce()
  })
})
