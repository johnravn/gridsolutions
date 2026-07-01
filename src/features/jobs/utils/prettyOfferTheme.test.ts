import { describe, expect, it } from 'vitest'
import {
  buildCustomAccentCss,
  resolvePrettyOfferTheme,
} from './prettyOfferTheme'

describe('resolvePrettyOfferTheme', () => {
  it('returns disabled theme when toggles are off', () => {
    const theme = resolvePrettyOfferTheme({
      pretty_use_customer_accent: false,
      pretty_use_customer_background: false,
      customer: {
        id: '1',
        name: 'Acme',
        email: null,
        phone: null,
        address: null,
        logo_path: null,
        accent_color: 'blue',
        accent_color_custom: null,
      },
    })
    expect(theme.useCustomerAccent).toBe(false)
    expect(theme.useCustomerBackground).toBe(false)
  })

  it('prefers custom hex over radix token', () => {
    const theme = resolvePrettyOfferTheme({
      pretty_use_customer_accent: true,
      pretty_use_customer_background: true,
      customer: {
        id: '1',
        name: 'Acme',
        email: null,
        phone: null,
        address: null,
        logo_path: null,
        accent_color: 'blue',
        accent_color_custom: '#AABBCC',
      },
    })
    expect(theme.customHex).toBe('#AABBCC')
    expect(theme.radixAccent).toBeNull()
    expect(theme.useCustomerAccent).toBe(true)
  })
})

describe('buildCustomAccentCss', () => {
  it('builds css variables from hex', () => {
    const css = buildCustomAccentCss('#AABBCC')
    expect(css['--accent-9']).toBe('#AABBCC')
    expect(css['--accent-a3']).toContain('rgba(170, 187, 204')
  })
})
