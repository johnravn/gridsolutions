import { describe, expect, it } from 'vitest'
import { resolveOfferTransportVehicles } from './resolveOfferTransportVehicles'

const fleet = [
  {
    id: 'van-1',
    name: 'Van 1',
    internally_owned: true,
    external_owner_id: null,
    owner_user_id: null,
    vehicle_category: 'van_medium',
  },
  {
    id: 'van-2',
    name: 'Van 2',
    internally_owned: false,
    external_owner_id: 'ext-1',
    owner_user_id: null,
    vehicle_category: 'van_medium',
  },
]

describe('resolveOfferTransportVehicles', () => {
  it('returns one slot per transport line', () => {
    const resolved = resolveOfferTransportVehicles({
      transportItems: [
        {
          vehicle_id: 'van-1',
          vehicle_name: 'Van 1',
          start_date: '2026-09-01T08:00:00Z',
          end_date: '2026-09-01T18:00:00Z',
        },
        {
          vehicle_category: 'van_medium',
          start_date: '2026-09-02T08:00:00Z',
          end_date: '2026-09-02T18:00:00Z',
        },
        {
          vehicle_category: 'C',
          start_date: '2026-09-03T08:00:00Z',
          end_date: '2026-09-03T18:00:00Z',
        },
      ],
      availableVehicles: fleet,
      defaultStart: '2026-09-01T00:00:00Z',
      defaultEnd: '2026-09-04T00:00:00Z',
    })

    expect(resolved).toHaveLength(3)
    expect(resolved[0]?.vehicleId).toBe('van-1')
    expect(resolved[1]?.vehicleId).toBe('van-2')
    expect(resolved[2]).toBeNull()
  })

  it('prefers unused internal vehicles for category picks', () => {
    const resolved = resolveOfferTransportVehicles({
      transportItems: [
        {
          vehicle_category: 'van_medium',
          start_date: '2026-09-01T08:00:00Z',
          end_date: '2026-09-01T18:00:00Z',
        },
      ],
      availableVehicles: fleet,
      defaultStart: '2026-09-01T00:00:00Z',
      defaultEnd: '2026-09-02T00:00:00Z',
    })

    expect(resolved[0]?.vehicleId).toBe('van-1')
  })

  it('allows the same explicit vehicle_id on multiple lines', () => {
    const resolved = resolveOfferTransportVehicles({
      transportItems: [
        {
          vehicle_id: 'van-1',
          start_date: '2026-09-01T08:00:00Z',
          end_date: '2026-09-01T12:00:00Z',
        },
        {
          vehicle_id: 'van-1',
          start_date: '2026-09-01T10:00:00Z',
          end_date: '2026-09-01T14:00:00Z',
        },
      ],
      availableVehicles: fleet,
      defaultStart: '2026-09-01T00:00:00Z',
      defaultEnd: '2026-09-02T00:00:00Z',
    })

    expect(resolved[0]?.vehicleId).toBe('van-1')
    expect(resolved[1]?.vehicleId).toBe('van-1')
  })
})
