import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  buildContaCustomerCreateBody,
  makeContaFetch,
  syncCustomersWithContaCore,
} from './customerSyncCore'

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

describe('buildContaCustomerCreateBody', () => {
  it('creates an ORGANIZATION payload when an org number is present', () => {
    const result = buildContaCustomerCreateBody({
      name: 'Acme AS',
      vat_number: '123 456 789',
      email: 'billing@acme.no',
      phone: null,
      address: 'Storgata 1, 0155 Oslo, Norway',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.customerType).toBe('ORGANIZATION')
    expect(result.body.orgNo).toBe('123456789')
  })

  it('creates an INDIVIDUAL payload without orgNo when VAT is missing', () => {
    const result = buildContaCustomerCreateBody({
      name: 'Ada Lovelace',
      vat_number: null,
      email: 'ada@example.com',
      phone: '+4712345678',
      address: 'Slottsplassen 1, 0010 Oslo',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.customerType).toBe('INDIVIDUAL')
    expect(result.body.orgNo).toBeUndefined()
    expect(result.body.name).toBe('Ada Lovelace')
  })

  it('requires a complete address', () => {
    const result = buildContaCustomerCreateBody({
      name: 'Ada Lovelace',
      vat_number: null,
      email: null,
      phone: null,
      address: 'Oslo',
    })
    expect(result.ok).toBe(false)
  })
})

function customersDb(rows: Array<Record<string, unknown>>) {
  const updates: Array<Record<string, unknown>> = []
  return {
    updates,
    db: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
        update: vi
          .fn()
          .mockImplementation((payload: Record<string, unknown>) => {
            updates.push(payload)
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }
          }),
      }),
    },
  }
}

describe('syncCustomersWithContaCore', () => {
  it('skips unlinked customers without org number or unique email', async () => {
    const conta = {
      get: vi.fn().mockResolvedValue({ hits: [], totalHits: 0 }),
      post: vi.fn(),
    }
    const { db } = customersDb([
      {
        id: 'c1',
        name: 'No VAT',
        email: null,
        phone: null,
        address: null,
        vat_number: null,
        conta_customer_id: null,
      },
    ])

    const result = await syncCustomersWithContaCore(
      'company-1',
      'org-1',
      conta,
      db as never,
    )

    expect(result.skipped).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.created).toBe(0)
    expect(conta.post).not.toHaveBeenCalled()
  })

  it('refreshes an already-linked private customer without org number', async () => {
    const conta = {
      get: vi.fn().mockResolvedValue({
        hits: [
          {
            id: 44,
            customerName: 'Ada Lovelace',
            emailAddress: 'ada@example.com',
            customerType: 'INDIVIDUAL',
            numberOfInvoices: 2,
            sumTotalInvoiced: 1000,
            sumRemainingInvoices: 0,
          },
        ],
        totalHits: 1,
      }),
      post: vi.fn(),
    }
    const { db, updates } = customersDb([
      {
        id: 'c1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
        address: null,
        vat_number: null,
        conta_customer_id: 44,
      },
    ])

    const result = await syncCustomersWithContaCore(
      'company-1',
      'org-1',
      conta,
      db as never,
    )

    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(conta.post).not.toHaveBeenCalled()
    expect(updates[0]).toMatchObject({
      conta_customer_id: 44,
      conta_invoice_count: 2,
    })
  })

  it('links a private customer by unique email', async () => {
    const conta = {
      get: vi.fn().mockResolvedValue({
        hits: [
          {
            id: 88,
            customerName: 'Ada Lovelace',
            emailAddress: 'ada@example.com',
            customerType: 'INDIVIDUAL',
            numberOfInvoices: 1,
          },
        ],
        totalHits: 1,
      }),
      post: vi.fn(),
    }
    const { db, updates } = customersDb([
      {
        id: 'c1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
        address: null,
        vat_number: null,
        conta_customer_id: null,
      },
    ])

    const result = await syncCustomersWithContaCore(
      'company-1',
      'org-1',
      conta,
      db as never,
    )

    expect(result.updated).toBe(1)
    expect(conta.post).not.toHaveBeenCalled()
    expect(updates[0]).toMatchObject({ conta_customer_id: 88 })
  })
})
