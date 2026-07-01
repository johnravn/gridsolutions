import {
  
  isRadixAccentColor
} from '@shared/theme/accentColorTypes'
import type {RadixAccentColor} from '@shared/theme/accentColorTypes';
import type { OfferDetail } from '../types'

export type PrettyOfferTheme = {
  useCustomerAccent: boolean
  useCustomerBackground: boolean
  radixAccent: RadixAccentColor | null
  customHex: string | null
  hasCustomerColor: boolean
}

export function resolvePrettyOfferTheme(
  offer: Pick<
    OfferDetail,
    'pretty_use_customer_accent' | 'pretty_use_customer_background' | 'customer'
  >,
): PrettyOfferTheme {
  const customer = offer.customer
  const customHex = customer?.accent_color_custom?.trim() || null
  const radixFromCustomer =
    customer?.accent_color && isRadixAccentColor(customer.accent_color)
      ? customer.accent_color
      : null
  const hasCustomerColor = Boolean(customHex || radixFromCustomer)

  return {
    useCustomerAccent: Boolean(
      offer.pretty_use_customer_accent && hasCustomerColor,
    ),
    useCustomerBackground: Boolean(
      offer.pretty_use_customer_background && hasCustomerColor,
    ),
    radixAccent: customHex ? null : radixFromCustomer,
    customHex,
    hasCustomerColor,
  }
}

export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex)
  if (!match) return null
  const value = match[1]
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

export function buildCustomAccentCss(hex: string): Record<string, string> {
  const rgb = hexToRgb(hex)
  if (!rgb) return {}
  const { r, g, b } = rgb
  return {
    '--accent-9': hex,
    '--accent-10': hex,
    '--accent-11': hex,
    '--accent-a2': `rgba(${r}, ${g}, ${b}, 0.1)`,
    '--accent-a3': `rgba(${r}, ${g}, ${b}, 0.15)`,
    '--accent-a4': `rgba(${r}, ${g}, ${b}, 0.2)`,
    '--accent-a5': `rgba(${r}, ${g}, ${b}, 0.3)`,
    '--accent-a6': `rgba(${r}, ${g}, ${b}, 0.4)`,
    '--accent-a7': `rgba(${r}, ${g}, ${b}, 0.5)`,
  }
}

export function getPrettyOfferThemeStyle(
  theme: PrettyOfferTheme,
): Record<string, string> | undefined {
  if (!theme.useCustomerAccent && !theme.useCustomerBackground) return undefined
  if (theme.customHex) return buildCustomAccentCss(theme.customHex)
  return undefined
}
