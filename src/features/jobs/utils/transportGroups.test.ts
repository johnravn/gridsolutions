import { describe, expect, it } from 'vitest'
import { normalizeTransportGroups } from './transportGroups'

describe('normalizeTransportGroups', () => {
  it('falls back to transport_items when groups lack nested items', () => {
    const groups = normalizeTransportGroups({
      transport_groups: [
        {
          id: 'group-1',
          offer_basis_id: 'basis-1',
          group_name: 'Vans',
          sort_order: 0,
          created_at: '2026-01-01',
        },
      ],
      transport_items: [
        {
          id: 'item-1',
          offer_basis_id: 'basis-1',
          transport_group_id: 'group-1',
          vehicle_name: 'Sprinter',
          vehicle_id: null,
          vehicle_category: 'van_medium',
          distance_km: 100,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 500,
          total_price: 1000,
          sort_order: 0,
        },
      ],
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].group_name).toBe('Vans')
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].id).toBe('item-1')
  })

  it('uses a synthetic group when only flat transport_items exist', () => {
    const groups = normalizeTransportGroups({
      transport_items: [
        {
          id: 'item-1',
          offer_basis_id: 'basis-1',
          vehicle_name: 'Sprinter',
          vehicle_id: null,
          vehicle_category: 'van_medium',
          distance_km: null,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 500,
          total_price: 500,
          sort_order: 0,
        },
      ],
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].group_name).toBe('Transport')
    expect(groups[0].items).toHaveLength(1)
  })
})
