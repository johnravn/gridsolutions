export const TECHNICIAN_CREW_BOOKING_TITLE = 'Technician'

export const TECHNICIAN_CREW_BOOKING_MODES = ['open', 'confirm_myself'] as const

export type TechnicianCrewBookingMode =
  (typeof TECHNICIAN_CREW_BOOKING_MODES)[number]

export const DEFAULT_TECHNICIAN_CREW_BOOKING_MODE: TechnicianCrewBookingMode =
  'confirm_myself'

export type TechnicianCrewPeriodInsert = {
  job_id: string
  company_id: string
  title: typeof TECHNICIAN_CREW_BOOKING_TITLE
  category: 'crew'
  start_at: string
  end_at: string
  needed_count: 1
}

export type TechnicianReservedCrewInsert = {
  time_period_id: string
  user_id: string
  status: 'confirmed'
  notes: null
}

export function technicianCrewPeriodInsert(input: {
  jobId: string
  companyId: string
  startAt: string
  endAt: string
}): TechnicianCrewPeriodInsert {
  return {
    job_id: input.jobId,
    company_id: input.companyId,
    title: TECHNICIAN_CREW_BOOKING_TITLE,
    category: 'crew',
    start_at: input.startAt,
    end_at: input.endAt,
    needed_count: 1,
  }
}

export function technicianReservedCrewInsert(
  mode: TechnicianCrewBookingMode,
  timePeriodId: string,
  currentUserId: string | null | undefined,
): TechnicianReservedCrewInsert | null {
  if (mode !== 'confirm_myself' || !currentUserId) return null
  return {
    time_period_id: timePeriodId,
    user_id: currentUserId,
    status: 'confirmed',
    notes: null,
  }
}
