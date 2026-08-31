import { describe, expect, it } from 'vitest'
import { resolveDefaultDiscountPercent } from './resolveDefaultDiscountPercent'

describe('resolveDefaultDiscountPercent', () => {
  it('uses the customer override when set, including 0', () => {
    expect(
      resolveDefaultDiscountPercent({
        customerDiscountPercent: 12,
        isPartner: false,
        companyCustomerDiscountPercent: 5,
        companyPartnerDiscountPercent: 20,
      }),
    ).toBe(12)

    expect(
      resolveDefaultDiscountPercent({
        customerDiscountPercent: 0,
        isPartner: true,
        companyCustomerDiscountPercent: 5,
        companyPartnerDiscountPercent: 20,
      }),
    ).toBe(0)
  })

  it('falls back to the company partner default for partners', () => {
    expect(
      resolveDefaultDiscountPercent({
        customerDiscountPercent: null,
        isPartner: true,
        companyCustomerDiscountPercent: 5,
        companyPartnerDiscountPercent: 20,
      }),
    ).toBe(20)
  })

  it('falls back to the company customer default for regular customers', () => {
    expect(
      resolveDefaultDiscountPercent({
        customerDiscountPercent: null,
        isPartner: false,
        companyCustomerDiscountPercent: 5,
        companyPartnerDiscountPercent: 20,
      }),
    ).toBe(5)
  })

  it('does not use the customer company default when a partner has no partner default', () => {
    expect(
      resolveDefaultDiscountPercent({
        customerDiscountPercent: null,
        isPartner: true,
        companyCustomerDiscountPercent: 5,
        companyPartnerDiscountPercent: null,
      }),
    ).toBe(0)
  })

  it('returns 0 when nothing is set', () => {
    expect(
      resolveDefaultDiscountPercent({
        customerDiscountPercent: null,
        isPartner: false,
        companyCustomerDiscountPercent: null,
        companyPartnerDiscountPercent: null,
      }),
    ).toBe(0)
  })
})
