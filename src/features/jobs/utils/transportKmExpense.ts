import {
  DEFAULT_TRANSPORT_COST_PER_KM,
  transportCostAmount,
} from './moneySuggestions'

/** Stable money-item source_id for job transport km expense. */
export const TRANSPORT_KM_SOURCE_ID = 'transport-km'

export function transportKmExpenseDescription(
  km: number,
  costPerKm: number,
): string {
  const rate =
    Number.isFinite(costPerKm) && costPerKm >= 0
      ? costPerKm
      : DEFAULT_TRANSPORT_COST_PER_KM
  return `Transport (${km} km × ${rate} kr/km)`
}

/**
 * Amount for Save km → expense.
 *
 * Rule: km × company `transport_cost_per_km` (Money rates), falling back to
 * {@link DEFAULT_TRANSPORT_COST_PER_KM} (5) when the company rate is missing.
 * Returns null when km is missing, zero, or negative.
 */
export function computeTransportKmExpenseAmount(
  km: number | null | undefined,
  costPerKm: number | null | undefined,
): number | null {
  return transportCostAmount(km, costPerKm)
}

export function resolveTransportCostPerKm(
  costPerKm: number | null | undefined,
): number {
  if (costPerKm != null && Number.isFinite(costPerKm) && costPerKm >= 0) {
    return costPerKm
  }
  return DEFAULT_TRANSPORT_COST_PER_KM
}
