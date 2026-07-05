import { describe, expect, it } from 'vitest'
import {
  isForcedPair,
  splitCrewConflicts,
  splitEquipmentConflicts,
  splitVehicleConflicts,
} from '@features/conflicts/utils/conflictCategories'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import {
  isCrewOverlapError,
  isEquipmentCapacityError,
  isVehicleOverlapError,
} from '@features/conflicts/api/forceBooking'

describe('isForcedPair', () => {
  it('returns true when either side is forced', () => {
    expect(isForcedPair(true, false)).toBe(true)
    expect(isForcedPair(false, true)).toBe(true)
    expect(isForcedPair(true, true)).toBe(true)
  })

  it('returns false when neither side is forced', () => {
    expect(isForcedPair(false, false)).toBe(false)
  })
})

describe('splitCrewConflicts', () => {
  const base: CrewConflictRow = {
    user_id: 'u1',
    user_display_name: 'Anna',
    period_id_1: 'p1',
    period_id_2: 'p2',
    job_id_1: 'j1',
    job_id_2: 'j2',
    job_title_1: 'Job A',
    job_title_2: 'Job B',
    start_1: '2026-01-01T08:00:00Z',
    end_1: '2026-01-01T18:00:00Z',
    start_2: '2026-01-01T10:00:00Z',
    end_2: '2026-01-01T20:00:00Z',
    forced_1: false,
    forced_2: false,
  }

  it('puts non-forced pairs in unresolved', () => {
    const result = splitCrewConflicts([base])
    expect(result.unresolved).toHaveLength(1)
    expect(result.forced).toHaveLength(0)
  })

  it('puts forced pairs in forced section', () => {
    const result = splitCrewConflicts([{ ...base, forced_2: true }])
    expect(result.unresolved).toHaveLength(0)
    expect(result.forced).toHaveLength(1)
  })
})

describe('splitVehicleConflicts', () => {
  const base: VehicleConflictRow = {
    vehicle_id: 'v1',
    vehicle_name: 'Sprinter',
    period_id_1: 'p1',
    period_id_2: 'p2',
    job_id_1: 'j1',
    job_id_2: 'j2',
    job_title_1: 'Job A',
    job_title_2: 'Job B',
    start_1: '2026-01-01T08:00:00Z',
    end_1: '2026-01-01T18:00:00Z',
    start_2: '2026-01-01T10:00:00Z',
    end_2: '2026-01-01T20:00:00Z',
    forced_1: false,
    forced_2: false,
  }

  it('splits vehicle conflicts like crew', () => {
    expect(splitVehicleConflicts([base]).unresolved).toHaveLength(1)
    expect(
      splitVehicleConflicts([{ ...base, forced_1: true }]).forced,
    ).toHaveLength(1)
  })
})

describe('splitEquipmentConflicts', () => {
  const base: EquipmentConflictRow = {
    item_id: 'i1',
    item_name: 'Cable',
    capacity: 5,
    total_reserved: 8,
    start_at: '2026-01-01T08:00:00Z',
    end_at: '2026-01-01T18:00:00Z',
    job_ids: ['j1', 'j2'],
    job_titles: ['Job A', 'Job B'],
    has_forced: false,
  }

  it('routes by has_forced', () => {
    expect(splitEquipmentConflicts([base]).unresolved).toHaveLength(1)
    expect(
      splitEquipmentConflicts([{ ...base, has_forced: true }]).forced,
    ).toHaveLength(1)
  })
})

describe('overlap error helpers', () => {
  it('detects crew overlap errors', () => {
    expect(
      isCrewOverlapError(
        'Crew member is already booked in an overlapping time period',
      ),
    ).toBe(true)
  })

  it('detects vehicle overlap errors', () => {
    expect(
      isVehicleOverlapError(
        'Vehicle is already booked in an overlapping time period',
      ),
    ).toBe(true)
  })

  it('detects equipment capacity errors', () => {
    expect(
      isEquipmentCapacityError(
        'Not enough quantity for item abc, requested=8 / capacity=5 in period',
      ),
    ).toBe(true)
  })
})
