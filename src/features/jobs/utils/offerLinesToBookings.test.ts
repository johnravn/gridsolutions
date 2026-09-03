import { describe, expect, it } from 'vitest'
import {
  equipmentDiscountOverridesFromOffer,
  offerLinesToBookings,
} from './offerLinesToBookings'
import type { OfferDetail } from '../types'

function baseOffer(overrides: Partial<OfferDetail> = {}): OfferDetail {
  return {
    id: 'offer-1',
    job_id: 'job-1',
    company_id: 'co-1',
    offer_type: 'technical',
    version_number: 1,
    offernr: 1,
    status: 'accepted',
    access_token: 'tok',
    title: 'Test offer',
    days_of_use: 2,
    discount_percent: 0,
    vat_percent: 25,
    show_price_per_line: true,
    equipment_subtotal: 1000,
    crew_subtotal: 0,
    transport_subtotal: 0,
    total_before_discount: 1000,
    total_after_discount: 1000,
    total_with_vat: 1250,
    locked: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as OfferDetail
}

describe('offerLinesToBookings', () => {
  it('includes company-owned stock equipment (is_internal)', () => {
    const result = offerLinesToBookings(
      baseOffer({
        days_of_use: 1,
        groups: [
          {
            id: 'g1',
            offer_basis_id: 'b1',
            group_name: 'PA',
            sort_order: 0,
            created_at: '',
            items: [
              {
                id: 'eq-1',
                offer_group_id: 'g1',
                item_id: 'item-1',
                group_id: null,
                quantity: 2,
                unit_price: 500,
                total_price: 1000,
                is_internal: true,
                sort_order: 0,
                item: {
                  id: 'item-1',
                  name: 'QSC K12.2',
                  brand: { id: 'br-1', name: 'QSC' },
                  model: 'K12.2',
                },
              },
            ],
          },
        ],
      }),
    )

    expect(result.equipment).toHaveLength(1)
    expect(result.all).toHaveLength(1)
    expect(result.equipment[0].itemName).toBe('QSC K12.2')
    expect(result.equipment[0].groupName).toBeNull()
    expect(result.equipment[0].description).toBe(
      '1 day - QSC K12.2 - QSC - K12.2',
    )
    expect(result.equipment[0].quantity).toBe(2)
    expect(result.equipment[0].unitPrice).toBe(500)
    expect(result.totalExVat).toBe(1000)
  })

  it('bakes rental factor into unit price and keeps ordered quantity', () => {
    // Public offer: unit 500 × qty 2 × rental 1.6 = 1600 on the line
    const result = offerLinesToBookings(
      baseOffer({
        days_of_use: 2,
        equipment_subtotal: 1600,
        total_before_discount: 1600,
        total_after_discount: 1600,
        total_with_vat: 2000,
        groups: [
          {
            id: 'g1',
            offer_basis_id: 'b1',
            group_name: 'PA',
            sort_order: 0,
            created_at: '',
            items: [
              {
                id: 'eq-rf',
                offer_group_id: 'g1',
                item_id: 'item-1',
                group_id: null,
                quantity: 2,
                unit_price: 500,
                total_price: 1600,
                is_internal: true,
                sort_order: 0,
                item: {
                  id: 'item-1',
                  name: 'QSC K12.2',
                  brand: { id: 'br-1', name: 'QSC' },
                  model: 'K12.2',
                },
              },
            ],
          },
        ],
      }),
    )

    const line = result.equipment[0]
    expect(line.quantity).toBe(2)
    expect(line.unitPrice).toBe(800)
    expect(line.quantity * line.unitPrice).toBe(1600)
    expect(line.totalPrice).toBe(1600)
    expect(line.rentalDays).toBe(2)
    expect(line.description).toBe('2 days - QSC K12.2 - QSC - K12.2')
    expect(result.totalExVat).toBe(1600)
  })

  it('puts offer discount on equipment lines instead of a bottom discount line', () => {
    const offer = baseOffer({
      discount_percent: 10,
      equipment_subtotal: 1600,
      crew_subtotal: 800,
      total_before_discount: 2400,
      total_after_discount: 2240,
      total_with_vat: 2800,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'b1',
          group_name: 'PA',
          sort_order: 0,
          created_at: '',
          items: [
            {
              id: 'eq-1',
              offer_group_id: 'g1',
              item_id: 'item-1',
              group_id: null,
              quantity: 2,
              unit_price: 500,
              total_price: 1600,
              is_internal: true,
              sort_order: 0,
            },
          ],
        },
      ],
      crew_items: [
        {
          id: 'crew-1',
          offer_basis_id: 'b1',
          role_title: 'Sound engineer',
          crew_count: 1,
          start_date: '2026-06-01',
          end_date: '2026-06-03',
          daily_rate: 400,
          total_price: 800,
          sort_order: 0,
        },
      ],
    })

    const discounts = equipmentDiscountOverridesFromOffer(offer)
    expect(discounts).toEqual({ 'eq-1': 10 })

    const result = offerLinesToBookings(offer)
    expect(result.all.some((l) => l.id.endsWith('-offer-discount'))).toBe(false)
    expect(result.equipment[0].unitPrice).toBe(800)
    expect(result.equipment[0].quantity).toBe(2)

    const billed = result.all.reduce((sum, line) => {
      const d = discounts[line.id] ?? 0
      return sum + line.unitPrice * line.quantity * (1 - d / 100)
    }, 0)
    expect(billed).toBe(2240)
  })

  it('bills transport as one line at the stored offer total', () => {
    const result = offerLinesToBookings(
      baseOffer({
        transport_items: [
          {
            id: 'tr-1',
            offer_basis_id: 'b1',
            vehicle_name: 'Van',
            vehicle_id: null,
            vehicle_category: 'van_small',
            distance_km: 200,
            start_date: '2026-06-01',
            end_date: '2026-06-02',
            days_used: 1,
            daily_rate: 300,
            total_price: 550,
            is_internal: true,
            sort_order: 0,
          },
        ],
      }),
    )

    expect(result.transport).toHaveLength(1)
    const line = result.transport[0]
    expect(line.quantity).toBe(1)
    expect(line.unitPrice).toBe(550)
    expect(line.totalPrice).toBe(550)
    expect(line.description).toBe('Transport - Van')
    expect(result.totalExVat).toBe(550)
  })

  it('uses inventory group name only when the offer line is a group', () => {
    const result = offerLinesToBookings(
      baseOffer({
        days_of_use: 1,
        groups: [
          {
            id: 'g1',
            offer_basis_id: 'b1',
            group_name: 'PA',
            sort_order: 0,
            created_at: '',
            items: [
              {
                id: 'eq-2',
                offer_group_id: 'g1',
                item_id: null,
                group_id: 'ig-1',
                quantity: 1,
                unit_price: 200,
                total_price: 200,
                is_internal: true,
                sort_order: 0,
                group: { id: 'ig-1', name: 'Mic pack' },
              },
            ],
          },
        ],
      }),
    )

    expect(result.equipment[0].groupName).toBe('Mic pack')
    expect(result.equipment[0].itemName).toBeNull()
    expect(result.equipment[0].description).toBe('1 day - Mic pack (Group)')
  })

  it('includes crew and transport from groups when flattened list is empty', () => {
    const result = offerLinesToBookings(
      baseOffer({
        crew_items: [
          {
            id: 'crew-1',
            offer_basis_id: 'b1',
            role_title: 'Sound engineer',
            crew_count: 1,
            start_date: '2026-06-01',
            end_date: '2026-06-03',
            daily_rate: 400,
            total_price: 800,
            sort_order: 0,
          },
        ],
        transport_items: [],
        transport_groups: [
          {
            id: 'tg1',
            offer_basis_id: 'b1',
            group_name: 'Trucks',
            sort_order: 0,
            created_at: '',
            items: [
              {
                id: 'tr-1',
                offer_basis_id: 'b1',
                vehicle_name: 'Van',
                vehicle_id: null,
                vehicle_category: 'van_small',
                distance_km: null,
                start_date: '2026-06-01',
                end_date: '2026-06-02',
                days_used: 1,
                daily_rate: 300,
                total_price: 300,
                is_internal: true,
                sort_order: 0,
              },
            ],
          },
        ],
      }),
    )

    expect(result.crew).toHaveLength(1)
    expect(result.transport).toHaveLength(1)
    expect(result.all).toHaveLength(2)
  })
})
