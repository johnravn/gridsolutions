import { describe, expect, it, vi } from 'vitest'
import { fetchCrewContaInvoiceLines } from './moneyCrewConta'

describe('fetchCrewContaInvoiceLines', () => {
  it('resolves suppliers then stamps orgnr on supplier-scoped lines', async () => {
    const get = vi.fn(async (path: string) => {
      if (path.includes('/suppliers?')) {
        return { hits: [{ id: 7, orgNo: '123456789' }] }
      }
      if (path.includes('supplierId=7')) {
        return {
          bookkeepingAccountLedgers: [
            {
              name: 'Ada AS',
              orgNo: undefined,
              ledgerLines: [
                {
                  id: 11,
                  amount: -4000,
                  invoiceNo: 'R-9',
                  date: '2026-03-12',
                  transactionId: 99,
                },
              ],
            },
          ],
        }
      }
      throw new Error(`unexpected path ${path}`)
    })

    const lines = await fetchCrewContaInvoiceLines({
      orgId: 'org-1',
      orgNumbers: ['123456789'],
      startDate: '2026-03-11',
      endDate: '2026-03-26',
      get,
      transactionUrl: (_org, tx, sourceType) =>
        tx
          ? `https://app.conta.no/regnskap/o/bilag/${tx}/rediger/${sourceType === 'EHF_RECEIVED' ? 'ehf' : 'kjop'}`
          : null,
    })

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      id: 11,
      supplierOrgNo: '123456789',
      invoiceNo: 'R-9',
      externalUrl: 'https://app.conta.no/regnskap/o/bilag/99/rediger/kjop',
    })
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('runs one unscoped scan for orgnrs without supplier hits', async () => {
    const get = vi.fn(async (path: string) => {
      if (path.includes('/suppliers?')) {
        return { hits: [] }
      }
      if (path.includes('supplier-ledger') && !path.includes('supplierId=')) {
        return {
          bookkeepingAccountLedgers: [
            {
              name: 'Payable',
              ledgerLines: [
                {
                  id: 1,
                  amount: 100,
                  supplierOrgNo: '111111111',
                },
                {
                  id: 2,
                  amount: 200,
                  supplierOrgNo: '222222222',
                },
                {
                  id: 3,
                  amount: 300,
                  supplierOrgNo: '999999999',
                },
              ],
            },
          ],
        }
      }
      throw new Error(`unexpected path ${path}`)
    })

    const lines = await fetchCrewContaInvoiceLines({
      orgId: 'org-1',
      orgNumbers: ['111111111', '222222222'],
      startDate: '2026-03-11',
      endDate: '2026-03-26',
      get,
      transactionUrl: () => null,
    })

    expect(lines.map((l) => l.id).sort()).toEqual([1, 2])
    // 2 supplier searches + 1 unscoped ledger
    expect(get).toHaveBeenCalledTimes(3)
  })
})
