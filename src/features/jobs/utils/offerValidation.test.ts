import { describe, expect, it } from 'vitest'
import {
  canAcceptOffer,
  canCreatePrettyOffer,
  canDuplicateOffer,
  canEditOffer,
  canLockOffer,
  validateOffer,
} from './offerValidation'
import { makeJobOffer, makeOfferDetail } from '@test/fixtures/offers'

describe('validateOffer', () => {
  it('passes a valid offer', () => {
    const result = validateOffer(makeOfferDetail())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('requires at least one line item category', () => {
    const result = validateOffer(
      makeOfferDetail({ groups: [], crew_items: [], transport_items: [] }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Offer must have at least one item (equipment, crew, or transport)',
    )
  })

  it('requires title and access token', () => {
    const result = validateOffer(
      makeOfferDetail({ title: '  ', access_token: '' }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Offer title is required')
    expect(result.errors).toContain('Access token is required')
  })

  it('validates days, discount, and VAT', () => {
    const result = validateOffer(
      makeOfferDetail({
        days_of_use: 0,
        discount_percent: 150,
        vat_percent: 15,
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Days of use must be at least 1')
    expect(result.errors).toContain(
      'Discount must be between 0 and 100 percent',
    )
    expect(result.errors).toContain('VAT must be either 0 or 25 percent')
  })
})

describe('offer state guards', () => {
  it('canLockOffer only for unlocked drafts', () => {
    expect(canLockOffer(makeJobOffer({ locked: false, status: 'draft' }))).toBe(
      true,
    )
    expect(canLockOffer(makeJobOffer({ locked: true, status: 'draft' }))).toBe(
      false,
    )
    expect(canLockOffer(makeJobOffer({ locked: false, status: 'sent' }))).toBe(
      false,
    )
  })

  it('canEditOffer for draft and sent when unlocked', () => {
    expect(canEditOffer(makeJobOffer({ status: 'draft', locked: false }))).toBe(
      true,
    )
    expect(canEditOffer(makeJobOffer({ status: 'sent', locked: false }))).toBe(
      true,
    )
    expect(
      canEditOffer(makeJobOffer({ status: 'accepted', locked: false })),
    ).toBe(false)
    expect(canEditOffer(makeJobOffer({ status: 'draft', locked: true }))).toBe(
      false,
    )
  })

  it('canAcceptOffer only when sent', () => {
    expect(canAcceptOffer(makeJobOffer({ status: 'sent' }))).toBe(true)
    expect(canAcceptOffer(makeJobOffer({ status: 'draft' }))).toBe(false)
    expect(canAcceptOffer(makeJobOffer({ status: 'accepted' }))).toBe(false)
    expect(canAcceptOffer(makeJobOffer({ status: 'rejected' }))).toBe(false)
    expect(canAcceptOffer(makeJobOffer({ status: 'viewed' }))).toBe(false)
  })

  it('canLockOffer rejects locked or non-draft offers', () => {
    expect(
      canLockOffer(makeJobOffer({ locked: false, status: 'accepted' })),
    ).toBe(false)
    expect(canLockOffer(makeJobOffer({ locked: true, status: 'sent' }))).toBe(
      false,
    )
  })

  it('canDuplicateOffer is always true', () => {
    expect(canDuplicateOffer(makeJobOffer({ status: 'accepted' }))).toBe(true)
  })

  it('canCreatePrettyOffer only for technical offers', () => {
    expect(
      canCreatePrettyOffer(makeJobOffer({ offer_type: 'technical' })),
    ).toBe(true)
    expect(canCreatePrettyOffer(makeJobOffer({ offer_type: 'pretty' }))).toBe(
      false,
    )
  })
})
