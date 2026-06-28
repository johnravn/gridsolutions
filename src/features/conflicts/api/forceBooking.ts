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
