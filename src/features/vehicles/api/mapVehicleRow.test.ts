import { describe, expect, it } from 'vitest'
import { mapVehicleRow } from './queries'

describe('mapVehicleRow', () => {
  it('flattens owner joins and coerces flags', () => {
    const row = mapVehicleRow({
      id: 'v1',
      name: 'Van',
      registration_no: 'AB12345',
      image_path: null,
      fuel: 'diesel',
      vehicle_category: 'van_medium',
      internally_owned: 1 as unknown as boolean,
      external_owner_id: null,
      owner_user_id: 'u1',
      deleted: false,
      external_owner: { name: 'Partner Co' },
      owner_user: [{ display_name: 'Ada', email: 'ada@example.com' }],
    })

    expect(row).toMatchObject({
      id: 'v1',
      name: 'Van',
      internally_owned: true,
      owner_user_name: 'Ada',
      external_owner_name: 'Partner Co',
    })
  })

  it('falls back to email when display_name missing', () => {
    const row = mapVehicleRow({
      id: 'v2',
      name: 'Car',
      internally_owned: false,
      owner_user_id: 'u2',
      owner_user: { display_name: null, email: 'bob@example.com' },
    })
    expect(row.owner_user_name).toBe('bob@example.com')
  })
})
