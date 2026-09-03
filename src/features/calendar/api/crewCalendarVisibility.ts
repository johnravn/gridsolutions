/** Grid calendar visibility for crew bookings (ICS feeds stay in api/_lib). */

export function isOpenCrewInviteStatus(
  status: string | null | undefined,
): boolean {
  return status !== 'accepted' && status !== 'declined'
}

export function isActiveCrewBooking(status: string): boolean {
  return status === 'confirmed' || status === 'planned'
}

/**
 * Users with an unanswered crew_invite on each time period.
 * Recipient statuses other than accepted/declined count as open.
 */
export function buildPendingInviteUserIdsByPeriod(
  matters: ReadonlyArray<{
    time_period_id: string | null
    matter_recipients?:
      | ReadonlyArray<{ user_id?: string | null; status?: string | null }>
      | { user_id?: string | null; status?: string | null }
      | null
  }>,
): Map<string, Set<string>> {
  const byPeriod = new Map<string, Set<string>>()

  for (const matter of matters) {
    if (!matter.time_period_id) continue
    const recipients = Array.isArray(matter.matter_recipients)
      ? matter.matter_recipients
      : matter.matter_recipients
        ? [matter.matter_recipients]
        : []

    for (const recipient of recipients) {
      const userId = recipient.user_id
      if (!userId || !isOpenCrewInviteStatus(recipient.status)) continue
      let set = byPeriod.get(matter.time_period_id)
      if (!set) {
        set = new Set<string>()
        byPeriod.set(matter.time_period_id, set)
      }
      set.add(userId)
    }
  }

  return byPeriod
}

/** Planned booking + unanswered invite for that person on that period. */
export function isPendingCrewInvitation(
  status: string,
  userId: string,
  timePeriodId: string,
  pendingByPeriod: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  if (status !== 'planned') return false
  return pendingByPeriod.get(timePeriodId)?.has(userId) ?? false
}

export function pendingInviteUserIdsForPeriod(
  crewForPeriod: ReadonlyArray<{ user_id: string; status: string }>,
  timePeriodId: string,
  pendingByPeriod: ReadonlyMap<string, ReadonlySet<string>>,
): Array<string> {
  return crewForPeriod
    .filter((c) =>
      isPendingCrewInvitation(
        c.status,
        c.user_id,
        timePeriodId,
        pendingByPeriod,
      ),
    )
    .map((c) => c.user_id)
}

/**
 * Whether a crew-period event should appear when the viewer is not a freelancer.
 * Hide periods where every booking is canceled (declined).
 */
export function companyCrewPeriodIsVisible(
  crewForPeriod: ReadonlyArray<{ status: string }>,
): boolean {
  if (crewForPeriod.length === 0) return true
  return crewForPeriod.some((c) => isActiveCrewBooking(c.status))
}

/**
 * PENDING label for a calendar event.
 * - Crew events with no focused person: any unanswered invite on the period
 * - Crew events with a focused person: that person's unanswered invite
 * - Job duration / other: the viewer's own unanswered invite
 */
export function eventHasPendingInviteLabel(args: {
  category?: string | null
  pendingInviteUserIds: ReadonlyArray<string>
  viewerUserId?: string | null
  focusUserId?: string | null
}): boolean {
  const { category, pendingInviteUserIds, viewerUserId, focusUserId } = args
  if (pendingInviteUserIds.length === 0) return false

  if (category === 'crew') {
    if (focusUserId) return pendingInviteUserIds.includes(focusUserId)
    return true
  }

  if (!viewerUserId) return false
  return pendingInviteUserIds.includes(viewerUserId)
}
