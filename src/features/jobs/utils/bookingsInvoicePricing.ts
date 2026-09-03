// src/features/jobs/utils/bookingsInvoicePricing.ts
import {
  calculateRentalFactor,
  equipmentLineTotal,
  roundMoney,
} from './offerCalculations'
import { resolveDefaultDiscountPercent } from './resolveDefaultDiscountPercent'
import type { RentalFactorConfig } from './offerCalculations'

/** Job rental period in days — same span used for offer basis days of use. */
export function jobDaysOfUse(
  start?: string | null,
  end?: string | null,
): number {
  if (!start || !end) return 1
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}

export function parseRentalFactorConfig(
  raw: unknown,
): RentalFactorConfig | null {
  try {
    if (typeof raw === 'string' && raw.trim()) {
      return JSON.parse(raw) as RentalFactorConfig
    }
    if (raw && typeof raw === 'object') {
      return raw as RentalFactorConfig
    }
  } catch {
    return null
  }
  return null
}

/**
 * Equipment booking → invoice line prices.
 * Daily list price × rental factor is baked into unit price (qty stays booked count),
 * matching `offerLinesToBookings`.
 */
export function priceEquipmentBookingLine({
  dailyUnitPrice,
  quantity,
  daysOfUse,
  rentalFactorConfig,
}: {
  dailyUnitPrice: number
  quantity: number
  daysOfUse: number
  rentalFactorConfig?: RentalFactorConfig | null
}): {
  unitPrice: number
  totalPrice: number
  rentalDays: number
} {
  const rentalDays = daysOfUse > 0 ? daysOfUse : 1
  const rentalFactor = calculateRentalFactor(rentalDays, rentalFactorConfig)
  const qty = quantity > 0 ? quantity : 1
  const totalPrice = equipmentLineTotal(dailyUnitPrice, qty, rentalFactor)
  const unitPrice = roundMoney(totalPrice / qty)
  return { unitPrice, totalPrice, rentalDays }
}

/** Apply customer/default discount to equipment lines only (same as offer). */
export function equipmentDiscountOverridesForLines(
  lineIds: Array<string>,
  discountPercent: number,
): Record<string, number> {
  if (!(discountPercent > 0)) return {}
  const overrides: Record<string, number> = {}
  for (const id of lineIds) {
    overrides[id] = discountPercent
  }
  return overrides
}

export function resolveBookingsEquipmentDiscountPercent({
  customerDiscountPercent,
  isPartner,
  companyCustomerDiscountPercent,
  companyPartnerDiscountPercent,
}: {
  customerDiscountPercent: number | null | undefined
  isPartner: boolean
  companyCustomerDiscountPercent: number | null | undefined
  companyPartnerDiscountPercent: number | null | undefined
}): number {
  return resolveDefaultDiscountPercent({
    customerDiscountPercent,
    isPartner,
    companyCustomerDiscountPercent,
    companyPartnerDiscountPercent,
  })
}
