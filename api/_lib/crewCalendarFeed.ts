/**
 * Visibility and titles for crew ICS subscriptions.
 * Confirmed bookings and unanswered invitations only.
 */

export function isCrewFeedBookingVisible(
  status: string,
  hasPendingInvite: boolean,
): boolean {
  if (status === 'confirmed') return true
  if (status === 'planned' && hasPendingInvite) return true
  return false
}

/** Prefix for subscribed crew calendar events. */
export function crewFeedEventTitle(
  jobTitle: string,
  status: string,
  personName?: string | null,
): string {
  const name = jobTitle.trim() || 'Event'
  const who = personName?.trim()
  if (who) {
    if (status === 'planned') return `CREW ${who} PENDING INVITATION: ${name}`
    return `CREW ${who}: ${name}`
  }
  if (status === 'planned') return `PENDING INVITATION: ${name}`
  return `CREW: ${name}`
}

export function crewPersonalEventTitle(
  eventTitle: string,
  personName?: string | null,
): string {
  const name = eventTitle.trim() || 'Event'
  const who = personName?.trim()
  if (who) return `CREW ${who} PERSONAL: ${name}`
  return `CREW PERSONAL: ${name}`
}

export function pendingInvitePeriodIdsFromMatters(
  matters: ReadonlyArray<{
    time_period_id: string | null
    matter_recipients?:
      | ReadonlyArray<{ status?: string | null }>
      | { status?: string | null }
      | null
  }>,
): Set<string> {
  const pending = new Set<string>()
  for (const matter of matters) {
    if (!matter.time_period_id) continue
    const recipients = Array.isArray(matter.matter_recipients)
      ? matter.matter_recipients
      : matter.matter_recipients
        ? [matter.matter_recipients]
        : []
    const hasOpenInvite = recipients.some(
      (r) => r.status !== 'accepted' && r.status !== 'declined',
    )
    if (hasOpenInvite) pending.add(matter.time_period_id)
  }
  return pending
}
