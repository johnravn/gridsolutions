// src/features/jobs/utils/offerCalculations.ts
import type {
  OfferCrewItem,
  OfferEquipmentItem,
  OfferTransportItem,
} from '../types'

export type RentalFactorConfig = Record<number, number>

export type OfferTotals = {
  equipmentSubtotal: number
  crewSubtotal: number
  transportSubtotal: number
  totalBeforeDiscount: number
  totalAfterDiscount: number
  totalWithVAT: number
  daysOfUse: number
  discountPercent: number
  vatPercent: number
  equipmentRentalFactor: number
  discountAmount: number
}

/**
 * Default rental factors (stiffer values for better profitability)
 */
const DEFAULT_RENTAL_FACTORS: RentalFactorConfig = {
  1: 1.0,
  2: 1.6,
  3: 2.0,
  4: 2.3,
  5: 2.5,
  7: 2.8,
  10: 3.2,
  14: 3.5,
  21: 4.0,
  30: 4.5,
}

/**
 * Calculate rental factor based on days of use.
 * Uses company-specific config if provided, otherwise falls back to defaults.
 * Based on industry standard rental rates where longer rentals
 * have decreasing incremental costs.
 */
export function calculateRentalFactor(
  days: number,
  customConfig?: RentalFactorConfig | null,
): number {
  if (days <= 0) return 1.0

  const factorMap = customConfig || DEFAULT_RENTAL_FACTORS

  // Exact match
  if (factorMap[days] !== undefined) {
    return factorMap[days]
  }

  // Find the two closest values
  const sortedDays = Object.keys(factorMap)
    .map(Number)
    .sort((a, b) => a - b)

  // If days is less than minimum, use minimum
  if (days < sortedDays[0]) {
    return factorMap[sortedDays[0]]
  }

  // If days is greater than maximum, extrapolate
  if (days > sortedDays[sortedDays.length - 1]) {
    const maxDay = sortedDays[sortedDays.length - 1]
    const maxFactor = factorMap[maxDay]
    // For extended periods, use linear growth
    const extraDays = days - maxDay
    const growthRate = 0.025 // 2.5% per day after max (diminishing)
    return maxFactor + extraDays * growthRate
  }

  // Interpolate between two points
  let lowerDay = sortedDays[0]
  let upperDay = sortedDays[sortedDays.length - 1]

  for (let i = 0; i < sortedDays.length - 1; i++) {
    if (days >= sortedDays[i] && days <= sortedDays[i + 1]) {
      lowerDay = sortedDays[i]
      upperDay = sortedDays[i + 1]
      break
    }
  }

  const lowerFactor = factorMap[lowerDay]
  const upperFactor = factorMap[upperDay]
  const ratio = (days - lowerDay) / (upperDay - lowerDay)
  return lowerFactor + (upperFactor - lowerFactor) * ratio
}

export type TransportLineCalcInput = {
  start_date: string
  end_date: string
  days_used?: number | null
  daily_rate?: number | null
  distance_km?: number | null
  distance_rate?: number | null
}

/**
 * Transport line total: daily_rate × billing days + distance increments.
 * Billing days: days_used when set, otherwise date span (min 1).
 * Matches TransportSection so Totals stay in sync with the editor.
 */
export function calculateTransportLineTotal(
  item: TransportLineCalcInput,
  defaults?: {
    vehicleDailyRate?: number | null
    vehicleDistanceRate?: number | null
    vehicleDistanceIncrement?: number | null
  },
): number {
  const days = Math.ceil(
    (new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) /
      (1000 * 60 * 60 * 24),
  )
  const derivedDays = Math.max(1, days)
  const billingDays = item.days_used ?? derivedDays

  const effectiveDailyRate = item.daily_rate ?? defaults?.vehicleDailyRate ?? 0
  const dailyCost = effectiveDailyRate * Math.max(0, billingDays)

  const increment = Math.max(1, defaults?.vehicleDistanceIncrement ?? 150)
  const distanceIncrements = item.distance_km
    ? Math.ceil(item.distance_km / increment)
    : 0
  const effectiveDistanceRate =
    item.distance_rate ?? defaults?.vehicleDistanceRate ?? null
  const distanceCost =
    effectiveDistanceRate && distanceIncrements > 0
      ? effectiveDistanceRate * distanceIncrements
      : 0

  return dailyCost + distanceCost
}

export function calculateOfferTotals(
  equipmentItems: Array<OfferEquipmentItem>,
  crewItems: Array<OfferCrewItem>,
  transportItems: Array<
    Pick<
      OfferTransportItem,
      'start_date' | 'end_date' | 'daily_rate' | 'distance_km' | 'distance_rate'
    > &
      Partial<Pick<OfferTransportItem, 'days_used'>>
  >,
  daysOfUse: number,
  discountPercent: number,
  vatPercent: number,
  rentalFactorConfig?: RentalFactorConfig | null,
  vehicleDistanceRate?: number | null,
  vehicleDistanceIncrement?: number | null,
  vehicleDailyRate?: number | null,
): OfferTotals {
  const equipmentRentalFactor = calculateRentalFactor(
    daysOfUse,
    rentalFactorConfig,
  )

  // Calculate equipment subtotal (unit price * qty * rental factor)
  const equipmentSubtotal = equipmentItems.reduce(
    (sum, item) =>
      sum + item.unit_price * item.quantity * equipmentRentalFactor,
    0,
  )

  // Calculate crew subtotal (total daily rate * days of use)
  const crewSubtotal = crewItems.reduce((sum, item) => {
    const dailyTotal = item.daily_rate * item.crew_count
    const days = Math.ceil(
      (new Date(item.end_date).getTime() -
        new Date(item.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
    )
    return sum + dailyTotal * Math.max(1, days)
  }, 0)

  const transportDefaults = {
    vehicleDailyRate,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
  }
  const transportSubtotal = transportItems.reduce(
    (sum, item) => sum + calculateTransportLineTotal(item, transportDefaults),
    0,
  )

  // Total before discount
  const totalBeforeDiscount =
    equipmentSubtotal + crewSubtotal + transportSubtotal

  // Apply discount (equipment only)
  const discountAmount = (equipmentSubtotal * discountPercent) / 100
  const totalAfterDiscount = totalBeforeDiscount - discountAmount

  // Apply VAT
  const vatAmount = (totalAfterDiscount * vatPercent) / 100
  const totalWithVAT = totalAfterDiscount + vatAmount

  return {
    equipmentSubtotal,
    crewSubtotal,
    transportSubtotal,
    totalBeforeDiscount,
    totalAfterDiscount,
    totalWithVAT,
    daysOfUse,
    discountPercent,
    vatPercent,
    equipmentRentalFactor,
    discountAmount,
  }
}

export function generateSecureToken(): string {
  // Generate a cryptographically secure random token
  // Using crypto.getRandomValues for browser compatibility
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}
