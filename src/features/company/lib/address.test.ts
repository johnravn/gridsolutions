import { describe, expect, it } from 'vitest'
import { formatCompanyAddress, parseCompanyAddress } from './address'

describe('parseCompanyAddress', () => {
  it('returns empty defaults for null/empty', () => {
    expect(parseCompanyAddress(null)).toEqual({
      address_line: '',
      zip_code: '',
      city: '',
      country: 'Norway',
    })
  })

  it('parses four-part CSV', () => {
    expect(parseCompanyAddress('Storgata 1, 0155, Oslo, Norway')).toEqual({
      address_line: 'Storgata 1',
      zip_code: '0155',
      city: 'Oslo',
      country: 'Norway',
    })
  })

  it('treats single part as address line', () => {
    expect(parseCompanyAddress('Warehouse')).toEqual({
      address_line: 'Warehouse',
      zip_code: '',
      city: '',
      country: 'Norway',
    })
  })
})

describe('formatCompanyAddress', () => {
  it('joins trimmed parts', () => {
    expect(
      formatCompanyAddress({
        address_line: ' Storgata 1 ',
        zip_code: '0155',
        city: 'Oslo',
        country: 'Norway',
      }),
    ).toBe('Storgata 1, 0155, Oslo, Norway')
  })
})
