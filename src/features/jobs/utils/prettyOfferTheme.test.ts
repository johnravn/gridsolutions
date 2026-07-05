import { describe, expect, it } from 'vitest'
import {
  buildCustomerBrandCss,
  buildDeckGradientCss,
  resolvePrettyOfferTheme,
} from './prettyOfferTheme'

describe('resolvePrettyOfferTheme', () => {
  it('returns disabled theme when brand colors are off', () => {
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
    expect(theme.useCustomerBrandColors).toBe(false)
  })

  it('enables brand colors from either legacy flag', () => {
    const theme = resolvePrettyOfferTheme({
      pretty_use_customer_accent: false,
      pretty_use_customer_background: true,
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
    expect(theme.useCustomerBrandColors).toBe(true)
  })

  it('prefers custom hex over radix token', () => {
    const theme = resolvePrettyOfferTheme({
      pretty_use_customer_accent: true,
      pretty_use_customer_background: false,
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
    expect(theme.useCustomerBrandColors).toBe(true)
  })
})

describe('buildCustomerBrandCss', () => {
  it('builds balanced brand variables from hex', () => {
    const css = buildCustomerBrandCss('#AABBCC')
    expect(css['--pretty-deck-brand-solid']).toBe('#AABBCC')
    expect(css['--pretty-deck-slide-alt-bg']).toBe('var(--gray-a2)')
    expect(css['--pretty-deck-hero-gradient']).toContain('var(--gray-a3)')
    expect(css['--pretty-deck-hero-gradient']).not.toContain('rgba')
    expect(css['--accent-9']).toBe('#AABBCC')
    expect(css['--accent-a11']).toBe('#AABBCC')
  })
})

describe('buildDeckGradientCss', () => {
  it('does not apply brand css when disabled', () => {
    const css = buildDeckGradientCss({
      useCustomerBrandColors: false,
      radixAccent: null,
      customHex: '#AABBCC',
      hasCustomerColor: true,
    })
    expect(css['--pretty-deck-brand-solid']).toBeUndefined()
  })

  it('applies balanced brand css when enabled', () => {
    const css = buildDeckGradientCss({
      useCustomerBrandColors: true,
      radixAccent: null,
      customHex: '#AABBCC',
      hasCustomerColor: true,
    })
    expect(css['--pretty-deck-brand-solid']).toBe('#AABBCC')
    expect(css['--pretty-deck-hero-gradient']).toContain('var(--gray-a2)')
  })
})
