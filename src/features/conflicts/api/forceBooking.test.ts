import { describe, expect, it, vi } from 'vitest'
import {
  BookingOverlapError,
  OVERLAP_NEEDS_FORCE,
  forcedBookingFields,
  isBookingOverlapError,
  isCrewOverlapError,
  isEquipmentCapacityError,
  isVehicleOverlapError,
} from '@features/conflicts/api/forceBooking'
import { makeOverlapConflict } from '@test/fixtures/conflicts'

describe('BookingOverlapError', () => {
  it('stores summary lines and conflicts', () => {
    const conflicts = [makeOverlapConflict()]
    const err = new BookingOverlapError(['Line 1', 'Line 2'], conflicts)

    expect(err.message).toBe(OVERLAP_NEEDS_FORCE)
    expect(err.name).toBe('BookingOverlapError')
    expect(err.summaryLines).toEqual(['Line 1', 'Line 2'])
    expect(err.conflicts).toBe(conflicts)
  })
})

describe('isBookingOverlapError', () => {
  it('returns true for BookingOverlapError instances', () => {
    const err = new BookingOverlapError([], [])
    expect(isBookingOverlapError(err)).toBe(true)
  })

  it('returns true for plain Error with OVERLAP_NEEDS_FORCE message', () => {
    const err = new Error(OVERLAP_NEEDS_FORCE)
    expect(isBookingOverlapError(err)).toBe(true)
  })

  it('returns false for other errors', () => {
    expect(isBookingOverlapError(new Error('other'))).toBe(false)
    expect(isBookingOverlapError('string')).toBe(false)
    expect(isBookingOverlapError(null)).toBe(false)
  })
})

describe('forcedBookingFields', () => {
  it('returns forced metadata with user id and ISO timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T10:00:00.000Z'))

    expect(forcedBookingFields('user-123')).toEqual({
      forced: true,
      forced_at: '2026-06-15T10:00:00.000Z',
      forced_by_user_id: 'user-123',
    })

    vi.useRealTimers()
  })
})

describe('isCrewOverlapError', () => {
  it('detects crew overlap message', () => {
    expect(
      isCrewOverlapError(
        'Crew member is already booked in an overlapping time period',
      ),
    ).toBe(true)
  })

  it('returns false for empty or unrelated messages', () => {
    expect(isCrewOverlapError(null)).toBe(false)
    expect(isCrewOverlapError(undefined)).toBe(false)
    expect(isCrewOverlapError('Vehicle conflict')).toBe(false)
  })
})

describe('isVehicleOverlapError', () => {
  it('detects vehicle overlap messages', () => {
    expect(isVehicleOverlapError('no_overlapping_vehicle_bookings')).toBe(true)
    expect(
      isVehicleOverlapError(
        'Vehicle is already booked in an overlapping time period',
      ),
    ).toBe(true)
    expect(isVehicleOverlapError('exclusion constraint violated')).toBe(true)
    expect(
      isVehicleOverlapError('conflicting key value violates exclusion'),
    ).toBe(true)
  })

  it('returns false for empty or unrelated messages', () => {
    expect(isVehicleOverlapError('')).toBe(false)
    expect(isVehicleOverlapError('crew overlap')).toBe(false)
  })
})

describe('isEquipmentCapacityError', () => {
  it('detects equipment capacity message', () => {
    expect(isEquipmentCapacityError('Not enough quantity for item')).toBe(true)
  })

  it('returns false for empty or unrelated messages', () => {
    expect(isEquipmentCapacityError(null)).toBe(false)
    expect(isEquipmentCapacityError('overlap')).toBe(false)
  })
})
