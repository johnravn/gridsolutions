import type { OverlapConflict } from '@features/conflicts/api/overlapChecks'

export const OVERLAP_NEEDS_FORCE = 'OVERLAP_NEEDS_FORCE'

export class BookingOverlapError extends Error {
  summaryLines: Array<string>
  conflicts: Array<OverlapConflict>

  constructor(summaryLines: Array<string>, conflicts: Array<OverlapConflict>) {
    super(OVERLAP_NEEDS_FORCE)
    this.name = 'BookingOverlapError'
    this.summaryLines = summaryLines
    this.conflicts = conflicts
  }
}

export function isBookingOverlapError(
  err: unknown,
): err is BookingOverlapError {
  return (
    err instanceof BookingOverlapError ||
    (err instanceof Error && err.message === OVERLAP_NEEDS_FORCE)
  )
}

export function forcedBookingFields(userId: string) {
  return {
    forced: true as const,
    forced_at: new Date().toISOString(),
    forced_by_user_id: userId,
  }
}

export function isCrewOverlapError(
  message: string | undefined | null,
): boolean {
  if (!message) return false
  return message.includes(
    'Crew member is already booked in an overlapping time period',
  )
}

export function isVehicleOverlapError(
  message: string | undefined | null,
): boolean {
  if (!message) return false
  return (
    message.includes('no_overlapping_vehicle_bookings') ||
    message.includes(
      'Vehicle is already booked in an overlapping time period',
    ) ||
    message.includes('exclusion constraint') ||
    /conflicting key value violates exclusion/.test(message)
  )
}

export function isEquipmentCapacityError(
  message: string | undefined | null,
): boolean {
  if (!message) return false
  return message.includes('Not enough quantity for item')
}
