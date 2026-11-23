import { describe, expect, it, vi } from 'vitest'
import { fetchContaEhfPreview } from './contaEhfPreview'

describe('fetchContaEhfPreview', () => {
  it('maps transaction lines and advanced lines for preview', async () => {
    const get = vi.fn(async () => ({
      id: 75275314,
      transactionNo: 88,
      transactionNoYear: '88-2026',
      date: '2026-03-12',
      description: 'EHF from Ada AS',
      transactionSourceType: 'EHF_RECEIVED',
      ehfReceivedId: 501,
      paymentType: 'NOT_PAID',
      transactionLines: [
        {
          id: 1,
          date: '2026-03-12',
          description: 'FOH tech',
          amount: -4000,
          bookkeepingAccountNo: '4000',
          vatCode: '1',
          invoiceNo: 'R-9',
          supplierId: 7,
        },
        {
          id: 2,
          date: '2026-03-12',
          description: 'VAT',
          amount: -1000,
          bookkeepingAccountNo: '2710',
          vatCode: '1',
          supplierId: 7,
        },
      ],
      transactionLinesAdvanced: [
        {
          id: 3,
          date: '2026-03-12',
          description: 'Payable',
          amount: 5000,
          debitBookkeepingAccountNo: '2400',
          creditBookkeepingAccountNo: '1920',
          debitSupplierId: 7,
          debitInvoiceNo: 'R-9',
        },
      ],
      transactionAttachments: [
        { id: 9, attachmentFileId: 44, status: 'ATTACHED' },
      ],
    }))

    const model = await fetchContaEhfPreview({
      orgId: '327064',
      transactionId: 75275314,
      get,
    })

    expect(get).toHaveBeenCalledWith(
      '/accounting/organizations/327064/transactions-advanced/75275314',
    )
    expect(model).toMatchObject({
      transactionId: 75275314,
      transactionNoYear: '88-2026',
      transactionSourceType: 'EHF_RECEIVED',
      ehfReceivedId: 501,
    })
    expect(model.lines).toHaveLength(3)
    expect(model.lines[0]).toMatchObject({
      description: 'FOH tech',
      amount: -4000,
      kind: 'line',
    })
    expect(model.lines[2]).toMatchObject({
      description: 'Payable',
      kind: 'advanced',
      debitBookkeepingAccountNo: '2400',
    })
    expect(model.attachments).toHaveLength(1)
  })
})
