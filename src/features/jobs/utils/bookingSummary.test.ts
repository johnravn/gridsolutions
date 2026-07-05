import { describe, expect, it } from 'vitest'
import { buildOfferBasisBookingSummary } from './bookingSummary'

describe('buildOfferBasisBookingSummary', () => {
  it('aggregates equipment, vehicles, and crew from basis line items', () => {
    const summary = buildOfferBasisBookingSummary(
      {
        groups: [
          {
            items: [
              { item_id: 'item-1', quantity: 2 },
              { group_id: 'group-1', quantity: 1 },
            ],
          },
        ],
        crew_items: [
          {
            id: 'crew-1',
            offer_basis_id: 'basis-1',
            role_title: 'Sound engineer',
            crew_count: 2,
            start_date: '2026-01-01',
            end_date: '2026-01-02',
            daily_rate: 1000,
            total_price: 2000,
            sort_order: 0,
          },
        ],
        transport_items: [
          {
            id: 'transport-1',
            offer_basis_id: 'basis-1',
            vehicle_name: 'Sprinter',
            vehicle_id: null,
            vehicle_category: null,
            distance_km: 0,
            start_date: '2026-01-01',
            end_date: '2026-01-02',
            daily_rate: 500,
            total_price: 500,
            is_internal: true,
            sort_order: 0,
          },
        ],
      },
      new Map([['item-1', 'Audio']]),
      new Map([['group-1', 'Lighting']]),
    )

    expect(summary.hasEquipment).toBe(true)
    expect(summary.equipmentByCategory).toEqual([
      { categoryName: 'Audio', quantity: 2 },
      { categoryName: 'Lighting', quantity: 1 },
    ])
    expect(summary.hasVehicles).toBe(true)
    expect(summary.vehicleNames).toEqual(['Sprinter'])
    expect(summary.crewLabels).toEqual(['Sound engineer ×2'])
  })

  it('falls back to vehicle category when vehicle_name is empty', () => {
    const summary = buildOfferBasisBookingSummary(
      {
        groups: [],
        crew_items: [],
        transport_items: [
          {
            id: 'transport-2',
            offer_basis_id: 'basis-1',
            vehicle_name: '',
            vehicle_id: null,
            vehicle_category: 'van_big',
            distance_km: 100,
            start_date: '2026-01-01',
            end_date: '2026-01-02',
            daily_rate: 500,
            total_price: 500,
            is_internal: true,
            sort_order: 0,
          },
        ],
      },
      new Map(),
      new Map(),
    )

    expect(summary.hasVehicles).toBe(true)
    expect(summary.vehicleNames).toEqual(['Van - Big'])
  })

  it('aggregates duplicate crew roles', () => {
    const summary = buildOfferBasisBookingSummary(
      {
        groups: [],
        crew_items: [
          {
            id: 'crew-1',
            offer_basis_id: 'basis-1',
            role_title: 'Stage hand',
            crew_count: 1,
            start_date: '2026-01-01',
            end_date: '2026-01-02',
            daily_rate: 500,
            total_price: 500,
            sort_order: 0,
          },
          {
            id: 'crew-2',
            offer_basis_id: 'basis-1',
            role_title: 'Stage hand',
            crew_count: 2,
            start_date: '2026-01-03',
            end_date: '2026-01-04',
            daily_rate: 500,
            total_price: 1000,
            sort_order: 1,
          },
        ],
        transport_items: [],
      },
      new Map(),
      new Map(),
    )

    expect(summary.crewLabels).toEqual(['Stage hand ×3'])
  })
})
