import { describe, expect, it } from 'vitest'
import {
  equipmentDiscountOverridesForLines,
  jobDaysOfUse,
  priceEquipmentBookingLine,
  resolveBookingsEquipmentDiscountPercent,
} from './bookingsInvoicePricing'
import { defaultDescriptionForLine } from './invoiceLineDescription'
import type { BookingInvoiceLine } from '../api/invoiceQueries'

describe('jobDaysOfUse', () => {
  it('returns at least 1 when dates are missing', () => {
    expect(jobDaysOfUse(null, null)).toBe(1)
    expect(jobDaysOfUse('2026-06-01', null)).toBe(1)
  })

  it('counts calendar span like offer basis (ceil, min 1)', () => {
    expect(jobDaysOfUse('2026-06-01T10:00:00Z', '2026-06-02T10:00:00Z')).toBe(1)
    expect(jobDaysOfUse('2026-06-01T10:00:00Z', '2026-06-03T10:00:00Z')).toBe(2)
  })
})

describe('priceEquipmentBookingLine', () => {
  it('bakes rental factor into unit price and keeps quantity', () => {
    // Default factor for 2 days is 1.6 → 500 × 2 × 1.6 = 1600
    const priced = priceEquipmentBookingLine({
      dailyUnitPrice: 500,
      quantity: 2,
      daysOfUse: 2,
    })
    expect(priced.rentalDays).toBe(2)
    expect(priced.unitPrice).toBe(800)
    expect(priced.totalPrice).toBe(1600)
  })

  it('uses factor 1.0 for a single day', () => {
    const priced = priceEquipmentBookingLine({
      dailyUnitPrice: 500,
      quantity: 1,
      daysOfUse: 1,
    })
    expect(priced.rentalDays).toBe(1)
    expect(priced.unitPrice).toBe(500)
    expect(priced.totalPrice).toBe(500)
  })
})

describe('equipmentDiscountOverridesForLines', () => {
  it('sets the same percent on every equipment line id', () => {
    expect(equipmentDiscountOverridesForLines(['a', 'b'], 10)).toEqual({
      a: 10,
      b: 10,
    })
  })

  it('returns empty when discount is zero or negative', () => {
    expect(equipmentDiscountOverridesForLines(['a'], 0)).toEqual({})
    expect(equipmentDiscountOverridesForLines(['a'], -5)).toEqual({})
  })
})

describe('resolveBookingsEquipmentDiscountPercent', () => {
  it('prefers customer discount over company defaults', () => {
    expect(
      resolveBookingsEquipmentDiscountPercent({
        customerDiscountPercent: 12,
        isPartner: false,
        companyCustomerDiscountPercent: 5,
        companyPartnerDiscountPercent: 15,
      }),
    ).toBe(12)
  })
})

describe('booking equipment description with rental days', () => {
  it('prefixes description with days like offer line expansion', () => {
    const priced = priceEquipmentBookingLine({
      dailyUnitPrice: 500,
      quantity: 2,
      daysOfUse: 2,
    })
    const line: BookingInvoiceLine = {
      id: 'eq-1',
      type: 'equipment',
      description: '',
      itemName: 'QSC K12.2',
      brandName: 'QSC',
      model: 'K12.2',
      rentalDays: priced.rentalDays,
      quantity: 2,
      unitPrice: priced.unitPrice,
      totalPrice: priced.totalPrice,
      vatPercent: 25,
      timePeriodId: '',
      timePeriodTitle: null,
      startAt: '',
      endAt: '',
    }
    expect(defaultDescriptionForLine(line)).toBe(
      '2 days - QSC K12.2 - QSC - K12.2',
    )
  })
})
