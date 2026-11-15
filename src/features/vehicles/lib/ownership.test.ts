import { describe, expect, it } from 'vitest'
import {
  vehicleOwnerBadge,
  vehicleOwnerKind,
  vehicleOwnerLabel,
} from './ownership'

describe('vehicleOwnerKind', () => {
  it('returns company when internally owned', () => {
    expect(
      vehicleOwnerKind({
        internally_owned: true,
        owner_user_id: 'u1',
        external_owner_id: 'c1',
      }),
    ).toBe('company')
  })

  it('prefers person over partner when not internal', () => {
    expect(
      vehicleOwnerKind({
        internally_owned: false,
        owner_user_id: 'u1',
        external_owner_id: 'c1',
      }),
    ).toBe('person')
  })

  it('returns partner when external only', () => {
    expect(
      vehicleOwnerKind({
        internally_owned: false,
        owner_user_id: null,
        external_owner_id: 'c1',
      }),
    ).toBe('partner')
  })
})

describe('vehicleOwnerLabel / badge', () => {
  it('labels personal owner by name', () => {
    const v = {
      internally_owned: false,
      owner_user_id: 'u1',
      owner_user_name: 'Ada',
    }
    expect(vehicleOwnerLabel(v)).toBe('Ada')
    expect(vehicleOwnerBadge(v)).toEqual({ label: 'Ada', color: 'amber' })
  })
})
