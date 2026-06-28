/** Booking status on reserved_crew (migrated from crew_request_status). */
export type CrewBookingStatus = 'planned' | 'confirmed' | 'canceled'

/**
 * Whether a freelancer should see a crew assignment on the calendar.
 * Matches jobs list visibility: confirmed bookings and invited (planned + crew_invite).
 */
export function isFreelancerVisibleCrewBooking(
  status: string,
  timePeriodId: string,
  invitedTimePeriodIds: ReadonlySet<string>,
): boolean {
  if (status === 'confirmed') return true
  if (status === 'planned' && invitedTimePeriodIds.has(timePeriodId))
    return true
  return false
}

export function buildFreelancerVisibleJobIds({
  crewRows,
  timePeriodJobById,
  invitedTimePeriodIds,
  userId,
}: {
  crewRows: ReadonlyArray<{
    time_period_id: string
    user_id: string
    status: string
  }>
  timePeriodJobById: ReadonlyMap<string, string>
  invitedTimePeriodIds: ReadonlySet<string>
  userId: string
}): Set<string> {
  const visibleJobIds = new Set<string>()

  for (const row of crewRows) {
    if (row.user_id !== userId) continue
    if (
      !isFreelancerVisibleCrewBooking(
        row.status,
        row.time_period_id,
        invitedTimePeriodIds,
      )
    ) {
      continue
    }
    const jobId = timePeriodJobById.get(row.time_period_id)
    if (jobId) visibleJobIds.add(jobId)
  }

  for (const tpId of invitedTimePeriodIds) {
    const jobId = timePeriodJobById.get(tpId)
    if (jobId) visibleJobIds.add(jobId)
  }

  return visibleJobIds
}
