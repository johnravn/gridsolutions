import { describe, expect, it } from 'vitest'
import {
  calculateOfferTotals,
  calculateRentalFactor,
} from './offerCalculations'
import type {
  OfferCrewItem,
  OfferEquipmentItem,
  OfferTransportItem,
} from '../types'

describe('calculateRentalFactor', () => {
  it('returns 1.0 for non-positive days', () => {
    expect(calculateRentalFactor(0)).toBe(1.0)
    expect(calculateRentalFactor(-5)).toBe(1.0)
  })

  it('returns exact default table values', () => {
    expect(calculateRentalFactor(1)).toBe(1.0)
    expect(calculateRentalFactor(4)).toBe(2.3)
    expect(calculateRentalFactor(30)).toBe(4.5)
  })

  it('interpolates between table points', () => {
    const factor = calculateRentalFactor(6)
    expect(factor).toBeGreaterThan(2.5)
    expect(factor).toBeLessThan(2.8)
  })

  it('extrapolates beyond maximum days', () => {
    expect(calculateRentalFactor(100)).toBeGreaterThan(4.5)
  })

  it('uses custom company config when provided', () => {
    const custom = { 1: 1.0, 5: 3.0 }
    expect(calculateRentalFactor(5, custom)).toBe(3.0)
    expect(calculateRentalFactor(3, custom)).toBeGreaterThan(1.0)
    expect(calculateRentalFactor(3, custom)).toBeLessThan(3.0)
  })
})

describe('calculateOfferTotals', () => {
  const equipment: Array<OfferEquipmentItem> = [
    {
      id: '1',
      offer_group_id: 'g1',
      item_id: null,
      group_id: null,
      quantity: 2,
      unit_price: 100,
      total_price: 200,
      is_internal: true,
      sort_order: 0,
    },
  ]

  const crew: Array<OfferCrewItem> = [
    {
      id: 'c1',
      offer_id: 'o1',
      role_title: 'Technician',
      crew_count: 1,
      start_date: '2026-06-01',
      end_date: '2026-06-03',
      daily_rate: 500,
      total_price: 1500,
      sort_order: 0,
    },
  ]

  const transport: Array<OfferTransportItem> = [
    {
      id: 't1',
      offer_id: 'o1',
      vehicle_name: 'Van',
      vehicle_id: null,
      vehicle_category: 'van_medium',
      distance_km: 200,
      start_date: '2026-06-01',
      end_date: '2026-06-02',
      daily_rate: 300,
      total_price: 0,
      is_internal: true,
      sort_order: 0,
    },
  ]

  it('calculates equipment with rental factor', () => {
    const totals = calculateOfferTotals(equipment, [], [], 4, 0, 25)
    // 2 * 100 * 2.3 = 460
    expect(totals.equipmentSubtotal).toBeCloseTo(460, 5)
    expect(totals.equipmentRentalFactor).toBe(2.3)
  })

  it('applies discount to equipment only', () => {
    const totals = calculateOfferTotals(equipment, crew, [], 1, 10, 25)
    expect(totals.discountAmount).toBe(20) // 10% of 200
    expect(totals.totalBeforeDiscount).toBe(1200) // 200 equipment + 1000 crew
    expect(totals.totalAfterDiscount).toBe(1180)
  })

  it('applies VAT to discounted total', () => {
    const totals = calculateOfferTotals(equipment, [], [], 1, 0, 25)
    expect(totals.totalWithVAT).toBe(250) // 200 + 25%
  })

  it('calculates transport with distance increments', () => {
    const totals = calculateOfferTotals(
      [],
      [],
      transport,
      1,
      0,
      0,
      null,
      50,
      150,
      300,
    )
    // daily: 300 * 1 day = 300
    // distance: ceil(200/150)=2 increments * 50 = 100
    expect(totals.transportSubtotal).toBe(400)
  })
})
