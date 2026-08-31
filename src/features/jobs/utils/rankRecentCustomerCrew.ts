export type RecentCustomerCrewPerson = {
  user_id: string
  display_name: string | null
  email: string
}

export type RecentCustomerCrewBooking = {
  user_id: string | null
  display_name: string | null
  email: string | null
  status: string
  start_at: string | null
}

export const RECENT_CUSTOMER_CREW_LIMIT = 8

function laterDate(a: string | null, b: string | null): string | null {
  if (a == null) return b
  if (b == null) return a
  return a >= b ? a : b
}

/**
 * Unique crew for a customer, confirmed bookings first, then most recently used.
 */
export function rankRecentCustomerCrew(
  bookings: Array<RecentCustomerCrewBooking>,
  options?: { limit?: number },
): Array<RecentCustomerCrewPerson> {
  const limit = options?.limit ?? RECENT_CUSTOMER_CREW_LIMIT
  const byUser = new Map<
    string,
    {
      user_id: string
      display_name: string | null
      email: string
      hasConfirmed: boolean
      lastStartAt: string | null
    }
  >()

  for (const booking of bookings) {
    if (!booking.user_id) continue
    if (booking.status === 'canceled') continue

    const existing = byUser.get(booking.user_id)
    const hasConfirmed =
      (existing?.hasConfirmed ?? false) || booking.status === 'confirmed'
    const lastStartAt = laterDate(
      existing?.lastStartAt ?? null,
      booking.start_at,
    )

    byUser.set(booking.user_id, {
      user_id: booking.user_id,
      display_name: booking.display_name ?? existing?.display_name ?? null,
      email: booking.email ?? existing?.email ?? '',
      hasConfirmed,
      lastStartAt,
    })
  }

  return [...byUser.values()]
    .sort((a, b) => {
      if (a.hasConfirmed !== b.hasConfirmed) {
        return a.hasConfirmed ? -1 : 1
      }
      if (a.lastStartAt !== b.lastStartAt) {
        if (a.lastStartAt == null) return 1
        if (b.lastStartAt == null) return -1
        return b.lastStartAt.localeCompare(a.lastStartAt)
      }
      const aName = a.display_name ?? a.email
      const bName = b.display_name ?? b.email
      return aName.localeCompare(bName)
    })
    .slice(0, limit)
    .map(({ user_id, display_name, email }) => ({
      user_id,
      display_name,
      email,
    }))
}

export function splitCrewPickerPeople<T extends { user_id: string }>(
  people: Array<T>,
  suggested: Array<T>,
  search: string,
): { suggested: Array<T>; rest: Array<T> } {
  if (search.trim()) {
    return { suggested: [], rest: people }
  }
  const suggestedIds = new Set(suggested.map((person) => person.user_id))
  return {
    suggested,
    rest: people.filter((person) => !suggestedIds.has(person.user_id)),
  }
}
