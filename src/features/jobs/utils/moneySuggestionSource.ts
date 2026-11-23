import type {
  JobMoneyItemCategory,
  JobMoneyItemSource,
  JobMoneyItemType,
} from '../api/moneyQueries'

/** Fields needed to resolve a human-readable Accounting source label. */
export type MoneySourceLabelInput = {
  source: JobMoneyItemSource
  type?: JobMoneyItemType | string
  category?: JobMoneyItemCategory | null
  /** Confirmed money item source_id */
  source_id?: string | null
  /** Suggestion sourceId */
  sourceId?: string | null
}

export type MoneySourceBadgeColor =
  | 'orange'
  | 'amber'
  | 'green'
  | 'red'
  | 'blue'
  | 'teal'
  | 'violet'
  | 'gray'

function sourceKeyStartsWith(
  s: MoneySourceLabelInput,
  prefix: string,
): boolean {
  return (
    (!!s.source_id && s.source_id.startsWith(prefix)) ||
    (!!s.sourceId && s.sourceId.startsWith(prefix))
  )
}

/**
 * Plain-language origin for Accounting suggestion / confirmed-item badges.
 *
 * Maps the coded `JobMoneyItemSource` (+ quote/transport/logging heuristics)
 * to labels that distinguish bookings, Conta incoming invoices, logging, and
 * other generators.
 */
export function getMoneySourceLabel(s: MoneySourceLabelInput): string {
  if (sourceKeyStartsWith(s, 'quote-')) return 'Subcontractor quote'
  if (s.source === 'logging' || sourceKeyStartsWith(s, 'logging-'))
    return 'Logging'
  if (s.category === 'transport') return 'Transport'
  if (s.source === 'offer') return 'Offer'
  if (s.source === 'crew') return 'Booking'
  if (s.source === 'conta') {
    if (s.type === 'income') return 'Conta sales invoice'
    return 'Conta incoming invoice'
  }
  return 'Manual'
}

export function getMoneySourceBadgeColor(
  s: MoneySourceLabelInput,
): MoneySourceBadgeColor {
  if (sourceKeyStartsWith(s, 'quote-')) return 'orange'
  if (s.source === 'logging' || sourceKeyStartsWith(s, 'logging-'))
    return 'violet'
  if (s.category === 'transport') return 'amber'
  if (s.source === 'offer') return 'green'
  if (s.source === 'crew') return 'red'
  if (s.source === 'conta') {
    if (s.type === 'income') return 'teal'
    return 'blue'
  }
  return 'gray'
}
