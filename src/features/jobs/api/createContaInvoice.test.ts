import { describe, expect, it } from 'vitest'
import {
  getVatCode,
  invoiceLinesHaveValidQuantities,
  mapBookingsToContaInvoiceLines,
} from './createContaInvoice'
import type { BookingInvoiceLine } from './invoiceQueries'

function line(
  id: string,
  description: string,
  overrides: Partial<BookingInvoiceLine> = {},
): BookingInvoiceLine {
  return {
    id,
    type: 'equipment',
    description,
    quantity: 1,
    unitPrice: 100,
    totalPrice: 100,
    vatPercent: 25,
    timePeriodId: 'tp-1',
    timePeriodTitle: null,
    startAt: '2026-08-01T00:00:00.000Z',
    endAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('mapBookingsToContaInvoiceLines', () => {
  it('assigns lineNo from array order so reordered preview lines stay in that order in Conta', () => {
    const lines = [line('crew', 'Crew'), line('eq', 'Speakers')]
    const mapped = mapBookingsToContaInvoiceLines(lines)

    expect(mapped.map((l) => l.description)).toEqual(['Crew', 'Speakers'])
    expect(mapped.map((l) => l.lineNo)).toEqual([1, 2])
  })

  it('applies per-line discounts and VAT codes', () => {
    const mapped = mapBookingsToContaInvoiceLines(
      [
        line('a', 'A', { vatPercent: 25, unitPrice: 200, quantity: 2 }),
        line('b', 'B', { vatPercent: 0 }),
      ],
      { a: 10 },
      true,
    )

    expect(mapped[0]).toMatchObject({
      description: 'A',
      quantity: 2,
      price: 200,
      discount: 10,
      vatCode: 'high',
      lineNo: 1,
    })
    expect(mapped[1]).toMatchObject({
      discount: 0,
      vatCode: 'no.vat',
      lineNo: 2,
    })
  })

  it('uses no.vat for every line when VAT is turned off', () => {
    const mapped = mapBookingsToContaInvoiceLines([line('a', 'A')], {}, false)
    expect(mapped[0].vatCode).toBe('no.vat')
  })

  it('refuses to map lines with empty or zero quantity', () => {
    expect(() =>
      mapBookingsToContaInvoiceLines([line('a', 'A', { quantity: 0 })]),
    ).toThrow('Every invoice line must have a quantity greater than 0.')
  })
})

describe('invoiceLinesHaveValidQuantities', () => {
  it('requires every line to have a quantity greater than 0', () => {
    expect(invoiceLinesHaveValidQuantities([line('a', 'A')])).toBe(true)
    expect(
      invoiceLinesHaveValidQuantities([line('a', 'A', { quantity: 0 })]),
    ).toBe(false)
    expect(
      invoiceLinesHaveValidQuantities([line('a', 'A', { quantity: NaN })]),
    ).toBe(false)
  })
})

describe('getVatCode', () => {
  it('maps percent bands', () => {
    expect(getVatCode(0)).toBe('no.vat')
    expect(getVatCode(25)).toBe('high')
    expect(getVatCode(15)).toBe('medium')
    expect(getVatCode(6)).toBe('low')
  })
})
