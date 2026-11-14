import { describe, expect, it } from 'vitest'
import {
  buildContaExpenseSuggestions,
  buildPrimaryIncomeSuggestions,
  buildTransportCostSuggestion,
  hasPrimaryIncomeSource,
  invoiceLinesExVatTotal,
  jobInvoiceExVatAmount,
  transportCostAmount,
} from './moneySuggestions'

describe('invoiceLinesExVatTotal', () => {
  it('sums lines ex VAT with discount', () => {
    expect(
      invoiceLinesExVatTotal([
        { price: 1000, quantity: 2, discount: 10 },
        { price: 500, quantity: 1, discount: 0 },
      ]),
    ).toBe(2300)
  })

  it('returns null for empty', () => {
    expect(invoiceLinesExVatTotal([])).toBeNull()
    expect(invoiceLinesExVatTotal(null)).toBeNull()
  })
})

describe('jobInvoiceExVatAmount', () => {
  it('prefers invoice_data lines', () => {
    expect(
      jobInvoiceExVatAmount({
        invoice_data: {
          invoiceLines: [{ price: 100, quantity: 1, discount: 0 }],
        },
        conta_response: { netAmount: 999 },
      }),
    ).toBe(100)
  })

  it('falls back to conta_response netAmount', () => {
    expect(
      jobInvoiceExVatAmount({
        invoice_data: {},
        conta_response: { netAmount: 440 },
      }),
    ).toBe(440)
  })
})

describe('transportCostAmount', () => {
  it('uses default 5 kr/km', () => {
    expect(transportCostAmount(10, null)).toBe(50)
  })

  it('uses company rate', () => {
    expect(transportCostAmount(12, 5)).toBe(60)
  })

  it('returns null when km missing', () => {
    expect(transportCostAmount(null, 5)).toBeNull()
    expect(transportCostAmount(0, 5)).toBeNull()
  })
})

describe('buildTransportCostSuggestion', () => {
  it('builds expense with transport category', () => {
    const s = buildTransportCostSuggestion({ kmDriven: 20, costPerKm: 5 })
    expect(s).toMatchObject({
      sourceId: 'transport-km',
      type: 'expense',
      category: 'transport',
      amount: 100,
      source: 'manual',
    })
  })
})

describe('buildPrimaryIncomeSuggestions', () => {
  const formatOfferLabel = (o: { title: string | null }) => o.title ?? 'Offer'

  it('prefers Conta invoice over offer', () => {
    const suggestions = buildPrimaryIncomeSuggestions({
      invoices: [
        {
          id: 'inv-1',
          status: 'created',
          created_at: '2026-01-01T00:00:00Z',
          invoice_data: {
            invoiceLines: [{ price: 8000, quantity: 1, discount: 0 }],
          },
          conta_invoice_id: 'C-1',
        },
      ],
      acceptedOffers: [
        {
          id: 'off-1',
          offernr: 1,
          title: 'Offer A',
          version_number: 1,
          total_after_discount: 9000,
          accepted_at: '2026-01-01T00:00:00Z',
        },
      ],
      formatOfferLabel,
    })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.sourceId).toBe('invoice-inv-1')
    expect(suggestions[0]?.amount).toBe(8000)
    expect(suggestions[0]?.source).toBe('conta')
    expect(suggestions[0]?.confidence).toBe('high')
  })

  it('falls back to offer total_after_discount (ex VAT)', () => {
    const suggestions = buildPrimaryIncomeSuggestions({
      invoices: [{ id: 'inv-fail', status: 'failed', created_at: 'x' }],
      acceptedOffers: [
        {
          id: 'off-1',
          offernr: 1,
          title: 'Offer A',
          version_number: 1,
          total_after_discount: 1234.5,
          accepted_at: null,
        },
      ],
      formatOfferLabel,
    })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.amount).toBe(1234.5)
    expect(suggestions[0]?.source).toBe('offer')
  })
})

describe('buildContaExpenseSuggestions', () => {
  it('marks project matches high and jobnr medium', () => {
    const high = buildContaExpenseSuggestions({
      matchMode: 'project',
      lines: [{ id: 1, description: 'Fuel', amount: -200, date: '2026-01-01' }],
    })
    expect(high[0]?.confidence).toBe('high')
    expect(high[0]?.amount).toBe(200)

    const med = buildContaExpenseSuggestions({
      matchMode: 'jobnr',
      lines: [{ id: 2, description: 'Job 12', amount: 50 }],
    })
    expect(med[0]?.confidence).toBe('medium')
  })
})

describe('hasPrimaryIncomeSource', () => {
  it('is true when accepted offer has ex-VAT total', () => {
    expect(
      hasPrimaryIncomeSource({
        invoices: [],
        acceptedOffers: [{ total_after_discount: 100 }],
      }),
    ).toBe(true)
  })

  it('is false when neither invoice nor offer', () => {
    expect(
      hasPrimaryIncomeSource({
        invoices: [{ status: 'pending', invoice_data: {} }],
        acceptedOffers: [{ total_after_discount: 0 }],
      }),
    ).toBe(false)
  })
})
