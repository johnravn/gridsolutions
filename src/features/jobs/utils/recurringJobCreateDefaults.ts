import { addDays } from 'date-fns'
import type {
  JobStatus,
  RecurringJobDetail,
  RecurringJobTemplate,
  RecurringJobTemplateCrewRole,
} from '../types'

export type RecurringJobCreateDefaults = {
  title?: string
  description?: string | null
  projectLeadUserId?: string | null
  customerId?: string | null
  customerUserId?: string | null
  customerContactId?: string | null
  status?: JobStatus
  startAt?: string
  endAt?: string
  crewRoles?: Array<RecurringJobTemplateCrewRole>
  /** True when defaults come from a recurring job template (not series defaults alone). */
  fromTemplate?: boolean
}

const TERMINAL_STATUSES: Array<JobStatus> = ['canceled', 'paid']

/** Parse Postgres TIME ("HH:MM:SS" or "HH:MM") into hours and minutes. */
export function parseTemplateStartTime(
  startTime: string,
): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(startTime.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }
  return { hours, minutes }
}

/** Apply a template's time-of-day to an ISO date, preserving the calendar day. */
export function applyStartTimeToDate(
  isoDate: string,
  startTime: string,
): string {
  const parsed = parseTemplateStartTime(startTime)
  if (!parsed) return isoDate

  const date = new Date(isoDate)
  date.setHours(parsed.hours, parsed.minutes, 0, 0)
  return date.toISOString()
}

function normalizeCrewRoles(
  roles: Array<RecurringJobTemplateCrewRole> | null | undefined,
): Array<RecurringJobTemplateCrewRole> {
  if (!roles?.length) return []
  return roles
    .map((role) => ({
      title: role.title.trim(),
      needed_count: Math.max(1, Math.floor(role.needed_count)),
      role_category: role.role_category?.trim().toLowerCase() || null,
    }))
    .filter((role) => role.title.length > 0)
}

/** Suggest field values when adding a new job to a recurring job series. */
export function buildJobDefaultsFromRecurringJob(
  detail: RecurringJobDetail,
): RecurringJobCreateDefaults {
  const lastJob =
    detail.jobs.length > 0 ? detail.jobs[detail.jobs.length - 1] : null

  const defaults: RecurringJobCreateDefaults = {
    projectLeadUserId: detail.project_lead_user_id,
    customerId: detail.customer_id,
    customerUserId: detail.customer_user_id,
    customerContactId: detail.customer_contact_id,
    description: detail.description,
    title: lastJob?.title ?? detail.title,
  }

  if (lastJob) {
    defaults.customerContactId ??= lastJob.customer_contact_id
    defaults.status = TERMINAL_STATUSES.includes(lastJob.status)
      ? 'planned'
      : lastJob.status

    if (lastJob.end_at) {
      const lastEnd = new Date(lastJob.end_at)
      const lastStart = lastJob.start_at ? new Date(lastJob.start_at) : null
      const durationMs = lastStart
        ? Math.max(lastEnd.getTime() - lastStart.getTime(), 60 * 60 * 1000)
        : 3 * 60 * 60 * 1000

      const nextStart = addDays(lastEnd, 1)
      if (lastStart) {
        nextStart.setHours(
          lastStart.getHours(),
          lastStart.getMinutes(),
          lastStart.getSeconds(),
          0,
        )
      }

      const nextEnd = new Date(nextStart.getTime() + durationMs)
      defaults.startAt = nextStart.toISOString()
      defaults.endAt = nextEnd.toISOString()
    }
  }

  return defaults
}

/** Merge recurring-job defaults with a template override. */
export function buildJobDefaultsFromTemplate(
  detail: RecurringJobDetail,
  template: RecurringJobTemplate,
): RecurringJobCreateDefaults {
  const base = buildJobDefaultsFromRecurringJob(detail)
  const defaults: RecurringJobCreateDefaults = {
    ...base,
    title: template.title,
    description: template.description ?? base.description,
    status: template.status,
    crewRoles: normalizeCrewRoles(template.crew_roles),
  }

  const durationMs = Math.max(template.duration_hours, 0.5) * 60 * 60 * 1000

  if (base.startAt) {
    defaults.startAt = template.start_time
      ? applyStartTimeToDate(base.startAt, template.start_time)
      : base.startAt
    defaults.endAt = new Date(
      new Date(defaults.startAt).getTime() + durationMs,
    ).toISOString()
  } else if (template.start_time) {
    const nextStart = new Date()
    nextStart.setHours(0, 0, 0, 0)
    defaults.startAt = applyStartTimeToDate(
      nextStart.toISOString(),
      template.start_time,
    )
    defaults.endAt = new Date(
      new Date(defaults.startAt).getTime() + durationMs,
    ).toISOString()
  }

  return {
    ...defaults,
    fromTemplate: true,
  }
}

/** Format template start time for HTML time input ("HH:MM"). */
export function formatTemplateStartTimeForInput(
  startTime: string | null | undefined,
): string {
  if (!startTime) return ''
  const parsed = parseTemplateStartTime(startTime)
  if (!parsed) return ''
  return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`
}

/** Format template start time for display. */
export function formatTemplateStartTimeLabel(
  startTime: string | null | undefined,
): string | null {
  const input = formatTemplateStartTimeForInput(startTime)
  return input || null
}

/** Normalize user or HTML time input to Postgres TIME ("HH:MM:SS"). */
export function normalizeTemplateStartTimeForDb(
  startTime: string,
): string | null {
  const parsed = parseTemplateStartTime(startTime)
  if (!parsed) return null
  return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}:00`
}
