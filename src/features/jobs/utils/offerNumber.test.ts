import { describe, expect, it } from 'vitest'
import {
  acceptedOfferInvoiceLineDescription,
  buildBasisVersionById,
  buildOfferSubVersionById,
  formatBasisVersionLabel,
  formatOfferNumberDisplay,
  formatOfferVersionOnBasis,
  getMaxLockedBasisVersion,
  sanitizeOfferTitleForInvoiceLine,
} from './offerNumber'

describe('basis and offer version labels', () => {
  it('formats basis and offer versions', () => {
    expect(formatBasisVersionLabel(1)).toBe('Basis v1')
    expect(formatOfferVersionOnBasis(2, 3)).toBe('v2.3')
  })

  it('assigns basis versions by created_at order', () => {
    const map = buildBasisVersionById([
      { id: 'b-old', created_at: '2026-01-01T00:00:00Z' },
      { id: 'b-new', created_at: '2026-02-01T00:00:00Z' },
    ])
    expect(map.get('b-old')).toBe(1)
    expect(map.get('b-new')).toBe(2)
  })

  it('assigns offer sub-versions within a basis', () => {
    const map = buildOfferSubVersionById([
      {
        id: 'o1',
        version_number: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'o2',
        version_number: 2,
        created_at: '2026-02-01T00:00:00Z',
      },
    ])
    expect(map.get('o1')).toBe(1)
    expect(map.get('o2')).toBe(2)
  })

  it('finds the highest locked basis version', () => {
    const versionById = buildBasisVersionById([
      { id: 'b1', created_at: '2026-01-01T00:00:00Z' },
      { id: 'b2', created_at: '2026-02-01T00:00:00Z' },
      { id: 'b3', created_at: '2026-03-01T00:00:00Z' },
    ])
    expect(
      getMaxLockedBasisVersion(
        [
          { id: 'b1', offers: [{ locked: false }] },
          { id: 'b2', offers: [{ locked: true }] },
          { id: 'b3', offers: [{ locked: false }] },
        ],
        versionById,
      ),
    ).toBe(2)
    expect(
      getMaxLockedBasisVersion(
        [{ id: 'b1', offers: [{ locked: false }] }],
        versionById,
      ),
    ).toBe(0)
  })
})

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
