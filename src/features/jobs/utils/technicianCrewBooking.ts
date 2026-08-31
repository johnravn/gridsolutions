export const TECHNICIAN_CREW_BOOKING_TITLE = 'Technician'

export const TECHNICIAN_CREW_BOOKING_MODES = ['open', 'confirm_myself'] as const

export type TechnicianCrewBookingMode =
  (typeof TECHNICIAN_CREW_BOOKING_MODES)[number]

export type TechnicianCrewBookingSelection = TechnicianCrewBookingMode | null

export const DEFAULT_TECHNICIAN_CREW_BOOKING_MODE: TechnicianCrewBookingSelection =
  null

export function isTechnicianCrewBookingMode(
  value: string | null,
): value is TechnicianCrewBookingMode {
  return value === 'open' || value === 'confirm_myself'
}

/** Clicking the selected card clears it so none are selected. */
export function toggleTechnicianCrewBooking(
  current: TechnicianCrewBookingSelection,
  clicked: string,
): TechnicianCrewBookingSelection {
  if (!isTechnicianCrewBookingMode(clicked)) return current
  return current === clicked ? null : clicked
}

/** Checkbox-card groups report every checked value; keep at most one. */
export function technicianCrewBookingFromCheckedValues(
  current: TechnicianCrewBookingSelection,
  values: ReadonlyArray<string>,
): TechnicianCrewBookingSelection {
  if (values.length === 0) return null
  const added = values.find((item) => item !== current) ?? values[0]
  return isTechnicianCrewBookingMode(added) ? added : null
}

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
