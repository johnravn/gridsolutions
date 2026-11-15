// src/features/calendar/domain.ts
import { fuzzySearch } from '@shared/lib/generalFunctions'
import type { EventInput } from '@fullcalendar/core'

/** What kinds of things can appear in the calendar */
export type CalendarKind = 'job' | 'item' | 'vehicle' | 'crew' | 'personal'

/** Single timezone for company + inspector calendars (reversible later via company setting). */
export const CALENDAR_TIME_ZONE = 'Europe/Oslo'

/** Default company calendar fetch window (days before/after now). */
export const CALENDAR_WINDOW_PAST_DAYS = 30
export const CALENDAR_WINDOW_FUTURE_DAYS = 90

export function defaultCalendarWindow(now: Date = new Date()): {
  fromDate: string
  toDate: string
} {
  const from = new Date(now)
  from.setDate(from.getDate() - CALENDAR_WINDOW_PAST_DAYS)
  const to = new Date(now)
  to.setDate(to.getDate() + CALENDAR_WINDOW_FUTURE_DAYS)
  return { fromDate: from.toISOString(), toDate: to.toISOString() }
}

/** UI category on CalendarPage (maps to CalendarKind filters). */
export type CalendarPageCategory =
  | 'jobDuration'
  | 'equipment'
  | 'crew'
  | 'transport'
  | 'all'

/** Common shape we can normalize DB records into before turning into FullCalendar EventInput */
export type CalendarRecord = {
  id: string
  title: string
  start: string // ISO
  end?: string | null // ISO
  allDay?: boolean
  kind: CalendarKind
  // Optional "who/what" the booking is for (used for filters)
  ref?: {
    jobId?: string
    itemId?: string // For single-item queries (backward compatibility)
    itemIds?: Array<string> // All item IDs for this equipment period
    vehicleId?: string
    userId?: string // crew
  }
  status?:
    | 'draft'
    | 'planned'
    | 'requested'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'canceled'
    | 'invoiced'
    | 'paid'
  notes?: string
  location?: string
  meta?: Record<string, unknown>
  // Project lead info for job events
  projectLead?:
    | {
        user_id: string
        display_name: string | null
        email: string
        avatar_url: string | null
      }
    | undefined
  // Category for coloring
  category?:
    | 'program'
    | 'equipment'
    | 'crew'
    | 'transport'
    | 'personal'
    | undefined
  // Job title for events that belong to a job
  jobTitle?: string | undefined
  // Crew user IDs on this time period (for "Crew" badge)
  crewUserIds?: Array<string>
  // Crew status by user ID (confirmed, planned, canceled)
  crewStatusByUserId?: Record<string, string>
  // Crew on any period for this job (for job duration events)
  jobCrewUserIds?: Array<string>
  jobCrewStatusByUserId?: Record<string, string>
  /** Users with an unanswered crew invite on this period (or job for program). */
  pendingInviteUserIds?: Array<string>
}

/** Typed FullCalendar extendedProps written by `toEventInputs`. */
export type CalendarExtendedProps = {
  kind: CalendarKind
  ref?: CalendarRecord['ref']
  status?: CalendarRecord['status']
  notes?: string
  location?: string
  projectLead?: CalendarRecord['projectLead']
  category?: CalendarRecord['category']
  jobTitle?: string
  crewUserIds?: Array<string>
  crewStatusByUserId?: Record<string, string>
  jobCrewUserIds?: Array<string>
  jobCrewStatusByUserId?: Record<string, string>
  pendingInviteUserIds?: Array<string>
}

/**
 * Title heuristic for the synthetic "Job duration" program period.
 * Prefer a dedicated flag on CalendarRecord when writers can supply one.
 */
export function isJobDurationTitle(title?: string | null): boolean {
  return title?.toLowerCase().includes('job duration') ?? false
}

/** Filter kinds for a page category (`null` = no kind filter / show all). */
export const CALENDAR_CATEGORY_KINDS: Record<
  CalendarPageCategory,
  Array<CalendarKind> | null
> = {
  all: null,
  jobDuration: ['job'],
  equipment: ['item'],
  transport: ['vehicle'],
  crew: ['crew', 'personal'],
}

export function defaultKindsForCategory(
  category: CalendarPageCategory,
): Array<CalendarKind> {
  return (
    CALENDAR_CATEGORY_KINDS[category] ?? [
      'job',
      'item',
      'vehicle',
      'crew',
      'personal',
    ]
  )
}

export function getCalendarExtendedProps(
  event: Pick<EventInput, 'extendedProps'>,
): CalendarExtendedProps {
  return (event.extendedProps ?? {}) as CalendarExtendedProps
}

/** Convert our normalized records to FullCalendar EventInput[] */
export function toEventInputs(rows: Array<CalendarRecord>): Array<EventInput> {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    start: r.start,
    end: r.end ?? undefined,
    allDay: r.allDay,
    extendedProps: {
      kind: r.kind,
      ref: r.ref,
      status: r.status,
      notes: r.notes,
      location: r.location,
      projectLead: r.projectLead,
      category: r.category,
      jobTitle: r.jobTitle,
      crewUserIds: r.crewUserIds,
      crewStatusByUserId: r.crewStatusByUserId,
      jobCrewUserIds: r.jobCrewUserIds,
      jobCrewStatusByUserId: r.jobCrewStatusByUserId,
      pendingInviteUserIds: r.pendingInviteUserIds,
      ...r.meta,
    } satisfies CalendarExtendedProps & Record<string, unknown>,
  }))
}

/** Basic client-side filtering */
export type CalendarFilter = {
  kinds?: Array<CalendarKind> // e.g. ['job'] or ['item', 'vehicle']
  scope?: {
    // limit to a specific entity
    jobId?: string
    itemId?: string
    vehicleId?: string
    userId?: string
  }
  text?: string // free search on title
}

export function applyCalendarFilter(
  events: Array<EventInput>,
  f: CalendarFilter | undefined,
) {
  if (!f) return events
  const kinds = f.kinds?.length ? new Set(f.kinds) : null
  const { jobId, itemId, vehicleId, userId } = f.scope ?? {}
  const q = f.text?.trim()

  // Use fuzzy matching for text search if available
  let filteredEvents = events.filter((e) => {
    const xp = getCalendarExtendedProps(e)
    const okKind = kinds ? kinds.has(xp.kind) : true
    const okJob = jobId ? xp.ref?.jobId === jobId : true
    // Check both itemId (single) and itemIds (array) for backward compatibility
    const okItem = itemId
      ? xp.ref?.itemId === itemId ||
        (Array.isArray(xp.ref?.itemIds) && xp.ref.itemIds.includes(itemId))
      : true
    const okVeh = vehicleId ? xp.ref?.vehicleId === vehicleId : true
    const crewStatusByUserId = xp.crewStatusByUserId
    const userCrewStatus = userId ? crewStatusByUserId?.[userId] : undefined
    // Declined/canceled crew bookings must not match a person filter
    if (userId && userCrewStatus === 'canceled') return false
    const okUser = userId
      ? xp.ref?.userId === userId ||
        (Array.isArray(xp.crewUserIds) && xp.crewUserIds.includes(userId))
      : true
    return okKind && okJob && okItem && okVeh && okUser
  })

  // Apply fuzzy text search if query provided
  if (q) {
    filteredEvents = fuzzySearch(
      filteredEvents,
      q,
      [
        (e) => e.title ?? '',
        (e) => getCalendarExtendedProps(e).jobTitle ?? null,
        (e) => getCalendarExtendedProps(e).projectLead?.display_name ?? null,
      ],
      0.3,
    )
  }

  return filteredEvents
}
