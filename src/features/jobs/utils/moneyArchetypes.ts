import { roundMoney } from './offerCalculations'
import type { MoneySuggestion } from './moneySuggestions'
import type { JobMoneyItem } from '../api/moneyQueries'

export type MoneyArchetype =
  | 'internal_equipment'
  | 'crew'
  | 'mixed'
  | 'transport_heavy'
  | 'general'

export type MoneyArchetypeSignals = {
  crewBookingCount: number
  stockEquipmentCount: number
  subrentalEquipmentCount: number
  hasSubcontractors: boolean
  hasSubcontractorQuotes: boolean
  transportBookingCount: number
  plannedOfferKm: number | null
  transportKmDriven: number | null
}

export type MoneyCompletenessHint = {
  id: string
  severity: 'info' | 'warn'
  message: string
}

export const MONEY_ARCHETYPE_LABELS: Record<MoneyArchetype, string> = {
  internal_equipment: 'Internal equipment',
  crew: 'Crew booking',
  mixed: 'Mixed job',
  transport_heavy: 'Transport-heavy',
  general: 'General',
}

export const MONEY_ARCHETYPE_BLURBS: Record<MoneyArchetype, string> = {
  internal_equipment:
    'Expect mostly income with little external COGS. Confirm income, enter km for transport cost, and check Conta only if needed.',
  crew: 'Confirm invoice/offer income (or crew sell rates), then freelancer/employee cost lines. Use hour/day toggle for employee rates.',
  mixed:
    'Confirm one primary income, crew costs, and subcontractor quotes. Watch for Conta lines that duplicate a quote.',
  transport_heavy:
    'Enter actual km driven (seeded from the offer when available). Transport cost = km × company rate.',
  general:
    'Review suggestions, confirm income and costs, then fill any gaps manually.',
}

/** Sum planned offer transport distance (customer-facing plan, not actuals). */
export function sumOfferTransportKm(
  items: Array<{ distance_km?: number | null }>,
): number | null {
  let sum = 0
  let any = false
  for (const item of items) {
    const km = Number(item.distance_km)
    if (!Number.isFinite(km) || km <= 0) continue
    sum += km
    any = true
  }
  return any ? roundMoney(sum) : null
}

/**
 * Detect primary archetype. Transport-heavy is a flag layered on top when
 * transport signals are strong; otherwise pick the dominant work type.
 */
export function detectMoneyArchetype(
  signals: MoneyArchetypeSignals,
): MoneyArchetype {
  const transportSignal =
    signals.transportBookingCount > 0 ||
    (signals.plannedOfferKm != null && signals.plannedOfferKm >= 50) ||
    (signals.transportKmDriven != null && signals.transportKmDriven >= 50)

  const hasExternal =
    signals.subrentalEquipmentCount > 0 ||
    signals.hasSubcontractors ||
    signals.hasSubcontractorQuotes
  const hasCrew = signals.crewBookingCount > 0
  const hasStock = signals.stockEquipmentCount > 0

  let base: MoneyArchetype = 'general'
  if (hasExternal && (hasCrew || hasStock)) {
    base = 'mixed'
  } else if (hasExternal && !hasCrew && !hasStock) {
    base = 'mixed'
  } else if (hasCrew && !hasStock && !hasExternal) {
    base = 'crew'
  } else if (hasStock && !hasCrew && !hasExternal) {
    base = 'internal_equipment'
  } else if (hasCrew && hasStock && !hasExternal) {
    // Internal gear + crew — treat as mixed for cost review, but not subrental-mixed
    base = 'mixed'
  } else if (hasCrew) {
    base = 'crew'
  } else if (hasStock) {
    base = 'internal_equipment'
  }

  if (transportSignal && base === 'general') return 'transport_heavy'
  if (transportSignal && (base === 'internal_equipment' || base === 'crew')) {
    // Prefer transport-heavy banner when transport dominates the fill-in
    const equipmentAndCrew =
      signals.crewBookingCount +
      signals.stockEquipmentCount +
      signals.subrentalEquipmentCount
    if (signals.transportBookingCount >= equipmentAndCrew) {
      return 'transport_heavy'
    }
  }
  if (transportSignal && base === 'general') return 'transport_heavy'
  return base
}

/** Latest quote per subcontractor (assumes quotes sorted version desc). */
export function latestQuotesBySubcontractor<
  T extends {
    id: string
    job_subcontractor_id: string
    version_number: number
    total_amount: number
    created_at: string
  },
>(quotes: Array<T>): Array<T> {
  const seen = new Set<string>()
  const out: Array<T> = []
  for (const q of quotes) {
    if (seen.has(q.job_subcontractor_id)) continue
    seen.add(q.job_subcontractor_id)
    out.push(q)
  }
  return out
}

export function buildSubcontractorQuoteSuggestions(input: {
  quotes: Array<{
    id: string
    job_subcontractor_id: string
    version_number: number
    total_amount: number
    created_at: string
    note?: string | null
  }>
  subcontractorNames: Record<string, string>
}): Array<MoneySuggestion> {
  return latestQuotesBySubcontractor(input.quotes)
    .filter((q) => Number(q.total_amount) > 0)
    .map((q) => {
      const name =
        input.subcontractorNames[q.job_subcontractor_id] || 'Subcontractor'
      return {
        id: `quote-${q.id}`,
        sourceId: `quote-${q.id}`,
        type: 'expense' as const,
        description: `${name} — quote v${q.version_number}`,
        amount: roundMoney(Number(q.total_amount)),
        date: q.created_at,
        reference: q.note?.trim() || undefined,
        source: 'manual' as const,
        category: 'equipment' as const,
      }
    })
}

/**
 * High-confidence pack for bulk-add: primary income, crew expenses, quotes, transport.
 * Conta supplier lines stay manual review (not included).
 */
export function filterHighConfidenceSuggestions(
  suggestions: Array<MoneySuggestion>,
): Array<MoneySuggestion> {
  return suggestions.filter((s) => {
    if (s.source === 'conta' && s.type === 'expense') return false
    if (s.source === 'conta' && s.type === 'income') return true
    if (s.source === 'offer' && s.type === 'income') return true
    if (s.source === 'crew' && s.type === 'expense') return true
    if (s.category === 'equipment' && s.sourceId.startsWith('quote-'))
      return true
    if (s.category === 'transport' && s.sourceId === 'transport-km') return true
    return false
  })
}

export function buildMoneyCompletenessHints(input: {
  confirmed: Array<Pick<JobMoneyItem, 'type' | 'category' | 'source'>>
  hasPrimaryIncomeSuggestion: boolean
  transportKmDriven: number | null
  plannedOfferKm: number | null
  hasTransportSignal: boolean
  unconfirmedHighConfidenceCount: number
  hasQuoteSuggestions: boolean
}): Array<MoneyCompletenessHint> {
  const hints: Array<MoneyCompletenessHint> = []
  const hasConfirmedIncome = input.confirmed.some((i) => i.type === 'income')

  if (!hasConfirmedIncome) {
    hints.push({
      id: 'no-income',
      severity: 'warn',
      message: input.hasPrimaryIncomeSuggestion
        ? 'No income confirmed yet — add the suggested invoice or offer (ex MVA).'
        : 'No income confirmed and no invoice/offer suggestion — add income manually.',
    })
  }

  if (
    input.hasTransportSignal &&
    (input.transportKmDriven == null || !(input.transportKmDriven > 0))
  ) {
    hints.push({
      id: 'missing-km',
      severity: 'warn',
      message:
        input.plannedOfferKm != null && input.plannedOfferKm > 0
          ? `Km driven not set — offer plans ${input.plannedOfferKm} km. Enter actual km for transport cost.`
          : 'Km driven not set — enter km to suggest transport cost (km × company rate).',
    })
  }

  const hasTransportCategory = input.confirmed.some(
    (i) => i.type === 'expense' && i.category === 'transport',
  )
  if (
    input.transportKmDriven != null &&
    input.transportKmDriven > 0 &&
    !hasTransportCategory
  ) {
    hints.push({
      id: 'transport-unconfirmed',
      severity: 'info',
      message:
        'Km is set but transport cost is not confirmed — add the transport suggestion.',
    })
  }

  if (input.hasQuoteSuggestions) {
    hints.push({
      id: 'quotes-pending',
      severity: 'info',
      message:
        'Subcontractor quote costs are suggested — confirm or edit before relying on profit.',
    })
  }

  if (input.unconfirmedHighConfidenceCount > 0) {
    hints.push({
      id: 'high-confidence-pending',
      severity: 'info',
      message: `${input.unconfirmedHighConfidenceCount} high-confidence suggestion${input.unconfirmedHighConfidenceCount === 1 ? '' : 's'} ready to add.`,
    })
  }

  return hints
}
