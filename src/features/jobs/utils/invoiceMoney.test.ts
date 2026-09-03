import { describe, expect, it } from 'vitest'
import { offerInvoiceTotalMismatch } from './invoiceMoney'

describe('offerInvoiceTotalMismatch', () => {
  it('treats matching øre as the same', () => {
    expect(offerInvoiceTotalMismatch(1000, 1000).differs).toBe(false)
    expect(offerInvoiceTotalMismatch(1000.004, 1000).differs).toBe(false)
  })

  it('flags a 1 øre difference', () => {
    const result = offerInvoiceTotalMismatch(1000.01, 1000)
    expect(result.differs).toBe(true)
    expect(result.delta).toBe(0.01)
    expect(result.invoiceExVat).toBe(1000.01)
    expect(result.offerExVat).toBe(1000)
  })
})
