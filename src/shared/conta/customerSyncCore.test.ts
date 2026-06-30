import { describe, expect, it, vi, beforeEach } from 'vitest'
import { makeContaFetch, syncCustomersWithContaCore } from './customerSyncCore'

describe('makeContaFetch', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ hits: [] }),
      }),
    )
  })

  it('performs GET requests with api key header', async () => {
    const conta = makeContaFetch({ apiKey: 'test-key' })
    await conta.get('/invoice/organizations/org-1/customers')

    expect(fetch).toHaveBeenCalledWith(
      'https://api.gateway.conta.no/invoice/organizations/org-1/customers',
      expect.objectContaining({
        headers: expect.objectContaining({ apiKey: 'test-key' }),
      }),
    )
  })
})

describe('syncCustomersWithContaCore', () => {
  it('skips customers without org number', async () => {
    const conta = {
      get: vi.fn().mockResolvedValue({ hits: [], totalHits: 0 }),
      post: vi.fn(),
    }
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'c1',
                  name: 'No VAT',
                  email: null,
                  phone: null,
                  address: null,
                  vat_number: null,
                  conta_customer_id: null,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }

    const result = await syncCustomersWithContaCore(
      'company-1',
      'org-1',
      conta,
      db as never,
    )

    expect(result.skipped).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.created).toBe(0)
  })
})
