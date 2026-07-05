import type { RecurringJobCrewEntry } from '../types'

export type RawCrewBooking = {
  user_id: string
  display_name: string | null
  email: string
  avatar_url: string | null
  job_id: string
  job_title: string
  jobnr: number | null
  role_title: string | null
  start_at: string | null
  end_at: string | null
  status: string
}

export function aggregateRecurringJobCrew(
  rows: Array<RawCrewBooking>,
): Array<RecurringJobCrewEntry> {
  const byUser = new Map<string, RecurringJobCrewEntry>()

  for (const row of rows) {
    let entry = byUser.get(row.user_id)
    if (!entry) {
      entry = {
        user_id: row.user_id,
        display_name: row.display_name,
        email: row.email,
        avatar_url: row.avatar_url,
        bookings: [],
      }
      byUser.set(row.user_id, entry)
    }

    entry.bookings.push({
      job_id: row.job_id,
      job_title: row.job_title,
      jobnr: row.jobnr,
      role_title: row.role_title,
      start_at: row.start_at,
      end_at: row.end_at,
      status: row.status,
    })
  }

  return [...byUser.values()].sort((a, b) => {
    const aName = a.display_name ?? a.email
    const bName = b.display_name ?? b.email
    return aName.localeCompare(bName)
  })
}
