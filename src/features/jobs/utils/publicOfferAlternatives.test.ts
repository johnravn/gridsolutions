import { describe, expect, it } from 'vitest'
import {
  formatOfferAlternativeLabel,
  pickDefaultPublicOfferId,
} from './publicOfferAlternatives'

describe('publicOfferAlternatives', () => {
  it('labels alternatives from sub-version numbers', () => {
    expect(formatOfferAlternativeLabel(1)).toBe('Alternative 1')
    expect(formatOfferAlternativeLabel(3)).toBe('Alternative 3')
    expect(formatOfferAlternativeLabel(4)).toBe('Alternative 4')
  })

  it('prefers accepted, then highest active, then highest included', () => {
    expect(
      pickDefaultPublicOfferId([
        { sub_version: 1, status: 'sent', offer: { id: 'a' } as any },
        { sub_version: 3, status: 'viewed', offer: { id: 'b' } as any },
        { sub_version: 4, status: 'superseded', offer: { id: 'c' } as any },
      ]),
    ).toBe('b')

    expect(
      pickDefaultPublicOfferId([
        { sub_version: 1, status: 'sent', offer: { id: 'a' } as any },
        { sub_version: 3, status: 'accepted', offer: { id: 'b' } as any },
        { sub_version: 4, status: 'sent', offer: { id: 'c' } as any },
      ]),
    ).toBe('b')

    expect(
      pickDefaultPublicOfferId([
        { sub_version: 1, status: 'superseded', offer: { id: 'a' } as any },
        { sub_version: 4, status: 'superseded', offer: { id: 'c' } as any },
      ]),
    ).toBe('c')
  })
})
