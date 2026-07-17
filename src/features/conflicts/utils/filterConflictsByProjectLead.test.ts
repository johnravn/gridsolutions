import { describe, expect, it } from 'vitest'
import {
  filterCrewConflictsByProjectLead,
  filterEquipmentConflictsByProjectLead,
  filterVehicleConflictsByProjectLead,
  hasAnyConflicts,
} from '@features/conflicts/utils/filterConflictsByProjectLead'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'

const crewRow = (
  overrides: Partial<CrewConflictRow> = {},
): CrewConflictRow => ({
  user_id: 'u1',
  user_display_name: 'Anna',
  period_id_1: 'p1',
  period_id_2: 'p2',
  job_id_1: 'j1',
  job_id_2: 'j2',
  job_title_1: 'Job A',
  job_title_2: 'Job B',
  start_1: '2026-01-01T10:00:00Z',
  end_1: '2026-01-01T12:00:00Z',
  start_2: '2026-01-01T11:00:00Z',
  end_2: '2026-01-01T13:00:00Z',
  forced_1: false,
  forced_2: false,
  ...overrides,
})

const vehicleRow = (
  overrides: Partial<VehicleConflictRow> = {},
): VehicleConflictRow => ({
  vehicle_id: 'v1',
  vehicle_name: 'Van',
  period_id_1: 'p1',
  period_id_2: 'p2',
  job_id_1: 'j1',
  job_id_2: 'j2',
  job_title_1: 'Job A',
  job_title_2: 'Job B',
  start_1: '2026-01-01T10:00:00Z',
  end_1: '2026-01-01T12:00:00Z',
  start_2: '2026-01-01T11:00:00Z',
  end_2: '2026-01-01T13:00:00Z',
  forced_1: false,
  forced_2: false,
  ...overrides,
})

const equipmentRow = (
  overrides: Partial<EquipmentConflictRow> = {},
): EquipmentConflictRow => ({
  item_id: 'i1',
  item_name: 'Camera',
  capacity: 1,
  total_reserved: 2,
  start_at: '2026-01-01T10:00:00Z',
  end_at: '2026-01-01T12:00:00Z',
  job_ids: ['j1', 'j2'],
  job_titles: ['Job A', 'Job B'],
  has_forced: false,
  ...overrides,
})

describe('filterCrewConflictsByProjectLead', () => {
  it('keeps conflicts where either job is led by the user', () => {
    const rows = [
      crewRow({ job_id_1: 'mine', job_id_2: 'other' }),
      crewRow({ job_id_1: 'other-a', job_id_2: 'other-b' }),
      crewRow({ job_id_1: 'other', job_id_2: 'mine' }),
    ]

    expect(filterCrewConflictsByProjectLead(rows, ['mine'])).toHaveLength(2)
  })
})

describe('filterVehicleConflictsByProjectLead', () => {
  it('keeps conflicts where either job is led by the user', () => {
    const rows = [
      vehicleRow({ job_id_1: 'mine', job_id_2: 'other' }),
      vehicleRow({ job_id_1: 'other-a', job_id_2: 'other-b' }),
    ]

    expect(filterVehicleConflictsByProjectLead(rows, ['mine'])).toHaveLength(1)
  })
})

describe('filterEquipmentConflictsByProjectLead', () => {
  it('keeps conflicts where any involved job is led by the user', () => {
    const rows = [
      equipmentRow({ job_ids: ['mine', 'other'] }),
      equipmentRow({ job_ids: ['other-a', 'other-b'] }),
    ]

    expect(filterEquipmentConflictsByProjectLead(rows, ['mine'])).toHaveLength(
      1,
    )
  })
})

describe('hasAnyConflicts', () => {
  it('returns true when any conflict list is non-empty', () => {
    expect(
      hasAnyConflicts({
        crewConflicts: [crewRow()],
        vehicleConflicts: [],
        equipmentConflicts: [],
      }),
    ).toBe(true)
  })

  it('returns false when all conflict lists are empty', () => {
    expect(
      hasAnyConflicts({
        crewConflicts: [],
        vehicleConflicts: [],
        equipmentConflicts: [],
      }),
    ).toBe(false)
  })
})
