import { describe, expect, it } from 'vitest'
import {
  acceptedOfferInvoiceLineDescription,
  formatOfferNumberDisplay,
  sanitizeOfferTitleForInvoiceLine,
} from './offerNumber'

describe('formatOfferNumberDisplay', () => {
  it('formats with hash and zero padding', () => {
    expect(formatOfferNumberDisplay(42)).toBe('#000042')
    expect(formatOfferNumberDisplay(123456)).toBe('#123456')
  })

  it('returns null for missing values', () => {
    expect(formatOfferNumberDisplay(null)).toBeNull()
    expect(formatOfferNumberDisplay(undefined)).toBeNull()
  })
})

describe('sanitizeOfferTitleForInvoiceLine', () => {
  it('strips legacy bookings suffix', () => {
    expect(sanitizeOfferTitleForInvoiceLine('Summer show (bookings)')).toBe(
      'Summer show',
    )
    expect(sanitizeOfferTitleForInvoiceLine('Summer show (Bookings)')).toBe(
      'Summer show',
    )
  })

  it('returns undefined for empty titles', () => {
    expect(sanitizeOfferTitleForInvoiceLine('')).toBeUndefined()
    expect(sanitizeOfferTitleForInvoiceLine('   ')).toBeUndefined()
  })
})

describe('acceptedOfferInvoiceLineDescription', () => {
  it('uses offer number when available', () => {
    expect(
      acceptedOfferInvoiceLineDescription({
        offernr: 12,
        version_number: 1,
        title: 'Corporate event',
      }),
    ).toBe('Offer #000012 — Corporate event')
  })

  it('falls back to version when offernr is missing', () => {
    expect(
      acceptedOfferInvoiceLineDescription({
        offernr: null,
        version_number: 3,
        title: 'Corporate event',
      }),
    ).toBe('Offer v3 — Corporate event')
  })

  it('omits trivial titles', () => {
    expect(
      acceptedOfferInvoiceLineDescription({
        offernr: 5,
        version_number: 1,
        title: 'Offer based on bookings',
      }),
    ).toBe('Offer #000005')
  })
})
