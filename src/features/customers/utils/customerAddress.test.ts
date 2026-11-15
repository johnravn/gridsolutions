import { describe, expect, it } from 'vitest'
import { composeCustomerAddress, parseCustomerAddress } from './customerAddress'

describe('parseCustomerAddress', () => {
  it('defaults empty addresses to Norway', () => {
    expect(parseCustomerAddress(null)).toEqual({
      address_line: '',
      zip_code: '',
      city: '',
      country: 'Norway',
    })
  })

  it('splits comma-separated parts', () => {
    expect(parseCustomerAddress('Storgata 1, 0155, Oslo, Norway')).toEqual({
      address_line: 'Storgata 1',
      zip_code: '0155',
      city: 'Oslo',
      country: 'Norway',
    })
  })
})

describe('composeCustomerAddress', () => {
  it('joins non-empty parts and returns null when empty', () => {
    expect(
      composeCustomerAddress({
        address_line: 'Storgata 1',
        zip_code: '0155',
        city: 'Oslo',
        country: 'Norway',
      }),
    ).toBe('Storgata 1, 0155, Oslo, Norway')
    expect(
      composeCustomerAddress({
        address_line: '',
        zip_code: '',
        city: '',
        country: '',
      }),
    ).toBeNull()
  })

  it('round-trips with parseCustomerAddress', () => {
    const original = 'Storgata 1, 0155, Oslo, Norway'
    expect(composeCustomerAddress(parseCustomerAddress(original))).toBe(
      original,
    )
  })
})
