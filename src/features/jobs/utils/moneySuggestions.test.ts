import { describe, expect, it } from 'vitest'
import {
  buildContaExpenseSuggestions,
  buildCrewExpenseSuggestions,
  buildPrimaryIncomeSuggestions,
  buildTransportCostSuggestion,
  computeCrewBookingRateAmount,
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

  it('reads Conta sumNet from conta_response', () => {
    expect(
      jobInvoiceExVatAmount({
        invoice_data: {},
        conta_response: { sumNet: 8800, sumTotal: 11000, sumRemaining: 0 },
      }),
    ).toBe(8800)
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

describe('computeCrewBookingRateAmount', () => {
  const window = {
    start_at: '2026-03-10T10:00:00Z',
    end_at: '2026-03-10T14:00:00Z', // 4 hours
  }

  it('uses freelancer personal rate without companyRates', () => {
    expect(
      computeCrewBookingRateAmount({
        role: 'freelancer',
        rate: 900,
        rate_type: 'hourly',
        ...window,
        billingUnit: 'hour',
        companyRates: null,
      }),
    ).toBe(3600)
  })

  it('defaults missing freelancer rate_type to hourly', () => {
    expect(
      computeCrewBookingRateAmount({
        role: 'freelancer',
        rate: 500,
        rate_type: null,
        ...window,
        billingUnit: 'day',
        companyRates: null,
      }),
    ).toBe(2000)
  })

  it('falls back to employee company rates when freelancer has no personal rate', () => {
    expect(
      computeCrewBookingRateAmount({
        role: 'freelancer',
        rate: null,
        rate_type: null,
        ...window,
        billingUnit: 'hour',
        companyRates: {
          employee_hourly_rate: 750,
          employee_daily_rate: null,
          owner_hourly_rate: null,
          owner_daily_rate: null,
        },
      }),
    ).toBe(3000)
  })
})

describe('buildCrewExpenseSuggestions', () => {
  const booking = {
    id: 'b1',
    user_name: 'Ada',
    role: 'freelancer',
    vat_number: '123 456 789',
    rateAmount: 5000,
    start_at: '2026-03-10T00:00:00Z',
  }

  it('prefers all Conta orgnr matches over billing rate', () => {
    const suggestions = buildCrewExpenseSuggestions({
      bookings: [booking],
      contaLines: [
        {
          id: 1,
          amount: -1200,
          invoiceNo: 'R-1',
          supplierOrgNo: '123456789',
          date: '2026-03-11',
          transactionId: 1,
          transactionSourceType: 'REGISTER_PURCHASE',
          externalUrl: 'https://app.conta.no/regnskap/o/bilag/1/rediger/kjop',
        },
        {
          id: 2,
          amount: 800,
          invoiceNo: 'R-2',
          supplierOrgNo: '123456789',
          date: '2026-03-12',
          transactionId: 2,
          transactionSourceType: 'EHF_RECEIVED',
        },
      ],
    })
    expect(suggestions).toHaveLength(2)
    expect(suggestions.every((s) => s.source === 'conta')).toBe(true)
    expect(suggestions.every((s) => s.category === 'crew')).toBe(true)
    expect(suggestions.map((s) => s.reference)).toEqual(['R-1', 'R-2'])
    expect(suggestions[0]?.externalUrl).toContain('/bilag/1/rediger/kjop')
    expect(suggestions[0]?.transactionId).toBe(1)
    expect(suggestions[0]?.isEhf).toBe(false)
    expect(suggestions[1]?.isEhf).toBe(true)
  })

  it('falls back to billing rate when no Conta match', () => {
    const suggestions = buildCrewExpenseSuggestions({
      bookings: [booking],
      contaLines: [
        {
          id: 9,
          amount: 100,
          supplierOrgNo: '999999999',
          invoiceNo: 'other',
        },
      ],
    })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      source: 'crew',
      category: 'crew',
      amount: 5000,
      sourceId: 'crew-b1',
    })
  })

  it('falls back to billing rate when Conta matches have zero amounts', () => {
    const suggestions = buildCrewExpenseSuggestions({
      bookings: [booking],
      contaLines: [
        {
          id: 3,
          amount: 0,
          supplierOrgNo: '123456789',
          invoiceNo: 'empty',
        },
      ],
    })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.source).toBe('crew')
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
