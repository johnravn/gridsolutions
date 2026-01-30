// src/features/jobs/utils/offerCalculations.ts
import type {
  OfferCrewItem,
  OfferEquipmentItem,
  OfferTransportItem,
} from '../types'

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
}

export function calculateOfferTotals(
  equipmentItems: Array<OfferEquipmentItem>,
  crewItems: Array<OfferCrewItem>,
  transportItems: Array<OfferTransportItem>,
  daysOfUse: number,
  discountPercent: number,
  vatPercent: number,
  vehicleDistanceRate?: number | null,
  vehicleDistanceIncrement?: number | null,
): OfferTotals {
  // Calculate equipment subtotal
  const equipmentSubtotal = equipmentItems.reduce(
    (sum, item) => sum + item.total_price,
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

  // Calculate transport subtotal: daily_rate * days + distance_rate * (distance rounded up to increment)
  const transportSubtotal = transportItems.reduce((sum, item) => {
    const days = Math.ceil(
      (new Date(item.end_date).getTime() -
        new Date(item.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
    )
    const dailyCost = item.daily_rate * Math.max(1, days)

    // Calculate distance cost if distance and rates are available
    const increment = vehicleDistanceIncrement ?? 150
    const distanceIncrements = item.distance_km
      ? Math.ceil(item.distance_km / increment)
      : 0
    const distanceCost =
      vehicleDistanceRate && distanceIncrements > 0
        ? vehicleDistanceRate * distanceIncrements
        : 0

    return sum + dailyCost + distanceCost
  }, 0)

  // Total before discount
  const totalBeforeDiscount =
    equipmentSubtotal + crewSubtotal + transportSubtotal

  // Apply discount
  const discountAmount = (totalBeforeDiscount * discountPercent) / 100
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
