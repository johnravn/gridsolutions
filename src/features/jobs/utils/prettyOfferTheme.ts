import { isRadixAccentColor } from '@shared/theme/accentColorTypes'
import type { RadixAccentColor } from '@shared/theme/accentColorTypes'
import type { OfferDetail } from '../types'

/** Approximate Radix accent-9 hex values for generating customer brand tints. */
const RADIX_ACCENT_HEX: Record<RadixAccentColor, string> = {
  gray: '#6f6e77',
  gold: '#f7c948',
  bronze: '#cd7f32',
  brown: '#ad7f58',
  yellow: '#f5d90a',
  amber: '#f59e0b',
  orange: '#f76808',
  tomato: '#f23d3d',
  red: '#e5484d',
  ruby: '#e54666',
  pink: '#d6409f',
  plum: '#ab4aba',
  purple: '#8e4ec6',
  violet: '#6e56cf',
  iris: '#5b5bd6',
  indigo: '#3451b2',
  blue: '#3e63dd',
  cyan: '#0891b2',
  teal: '#12a594',
  jade: '#00a972',
  green: '#30a46c',
  grass: '#46a758',
  mint: '#00c897',
  lime: '#65a30d',
  sky: '#0284c7',
}

export type PrettyOfferTheme = {
  useCustomerBrandColors: boolean
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
  const brandEnabled = Boolean(
    (offer.pretty_use_customer_accent ||
      offer.pretty_use_customer_background) &&
      hasCustomerColor,
  )

  return {
    useCustomerBrandColors: brandEnabled,
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

export function resolveCustomerColorHex(theme: PrettyOfferTheme): string | null {
  if (theme.customHex) return theme.customHex
  if (theme.radixAccent) return RADIX_ACCENT_HEX[theme.radixAccent]
  return null
}

export function getContrastText(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  const luminance =
    (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff'
}

/** Brand tokens for accents and decorative shapes; backgrounds stay neutral gray. */
export function buildCustomerBrandCss(hex: string): Record<string, string> {
  const rgb = hexToRgb(hex)
  if (!rgb) return {}
  const { r, g, b } = rgb
  const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`

  return {
    '--pretty-deck-brand-solid': hex,
    '--pretty-deck-brand-a3': rgba(0.12),
    '--pretty-deck-brand-a4': rgba(0.2),
    '--pretty-deck-brand-a5': rgba(0.32),
    '--pretty-deck-brand-a6': rgba(0.42),
    '--pretty-deck-brand-contrast': getContrastText(hex),
    '--pretty-deck-slide-alt-bg': 'var(--gray-a2)',
    '--pretty-deck-hero-gradient':
      'linear-gradient(135deg, var(--gray-a3) 0%, var(--gray-a2) 45%, var(--color-panel-solid) 100%)',
    /* Remap Radix accent scale so buttons, tables, etc. use customer brand */
    '--accent-9': hex,
    '--accent-10': hex,
    '--accent-11': hex,
    '--accent-12': hex,
    '--accent-a2': rgba(0.08),
    '--accent-a3': rgba(0.12),
    '--accent-a4': rgba(0.2),
    '--accent-a5': rgba(0.32),
    '--accent-a6': rgba(0.42),
    '--accent-a8': rgba(0.55),
    '--accent-a11': hex,
    '--focus-8': rgba(0.55),
  }
}

export function buildDeckGradientCss(
  theme: PrettyOfferTheme,
): Record<string, string> {
  if (!theme.useCustomerBrandColors) return {}

  const hex = resolveCustomerColorHex(theme)
  if (!hex) return {}

  return buildCustomerBrandCss(hex)
}
