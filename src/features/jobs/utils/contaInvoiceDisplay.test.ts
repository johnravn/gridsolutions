import { describe, expect, it } from 'vitest'
import {
  buildContaInvoiceDisplay,
  parseContaInvoiceLines,
} from './contaInvoiceDisplay'

describe('parseContaInvoiceLines', () => {
  it('maps Conta lines with computed net', () => {
    expect(
      parseContaInvoiceLines([
        {
          lineNo: 1,
          description: 'Crew',
          price: 1000,
          quantity: 2,
          discount: 10,
          vatCode: 'high',
        },
      ]),
    ).toEqual([
      {
        lineNo: 1,
        description: 'Crew',
        quantity: 2,
        price: 1000,
        discount: 10,
        vatCode: 'high',
        sumNet: 1800,
      },
    ])
  })
})

describe('buildContaInvoiceDisplay', () => {
  it('prefers fetched Conta lines and fills header from stored invoice_data', () => {
    const display = buildContaInvoiceDisplay({
      conta_invoice_id: '1042',
      status: 'created',
      invoice_data: {
        orgReference: 'Grid AS',
        customerReference: 'PO-9',
        personalMessage: 'Festival setup',
        invoiceDate: '2026-03-01',
        invoiceLines: [{ description: 'Old', price: 1, quantity: 1 }],
      },
      fetched: {
        invoiceNo: 1042,
        status: 'SENT',
        sumNet: 5000,
        sumVAT: 1250,
        sumTotal: 6250,
        invoiceLines: [
          {
            lineNo: 1,
            description: 'Lighting',
            price: 5000,
            quantity: 1,
            discount: 0,
            sumNet: 5000,
          },
        ],
      },
    })

    expect(display.header.invoiceNo).toBe('1042')
    expect(display.header.status).toBe('SENT')
    expect(display.header.orgReference).toBe('Grid AS')
    expect(display.header.customerReference).toBe('PO-9')
    expect(display.header.personalMessage).toBe('Festival setup')
    expect(display.header.invoiceDate).toBe('2026-03-01')
    expect(display.header.sumTotal).toBe(6250)
    expect(display.lines).toHaveLength(1)
    expect(display.lines[0]?.description).toBe('Lighting')
  })

  it('falls back to invoice_data when Conta has not been fetched', () => {
    const display = buildContaInvoiceDisplay({
      invoice_data: {
        invoiceLines: [{ description: 'Transport', price: 200, quantity: 3 }],
        personalMessage: 'Thanks',
      },
    })
    expect(display.lines[0]?.sumNet).toBe(600)
    expect(display.header.personalMessage).toBe('Thanks')
    expect(display.header.sumNet).toBe(600)
  })
})
