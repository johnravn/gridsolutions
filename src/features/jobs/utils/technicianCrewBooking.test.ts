import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TECHNICIAN_CREW_BOOKING_MODE,
  TECHNICIAN_CREW_BOOKING_TITLE,
  technicianCrewPeriodInsert,
  technicianReservedCrewInsert,
} from './technicianCrewBooking'

describe('technicianCrewBooking', () => {
  it('inserts a Technician crew period for the job duration', () => {
    expect(
      technicianCrewPeriodInsert({
        jobId: 'job-1',
        companyId: 'company-1',
        startAt: '2026-08-30T08:00:00.000Z',
        endAt: '2026-08-30T18:00:00.000Z',
      }),
    ).toEqual({
      job_id: 'job-1',
      company_id: 'company-1',
      title: TECHNICIAN_CREW_BOOKING_TITLE,
      category: 'crew',
      start_at: '2026-08-30T08:00:00.000Z',
      end_at: '2026-08-30T18:00:00.000Z',
      needed_count: 1,
    })
  })

  it('defaults to confirming the current user', () => {
    expect(DEFAULT_TECHNICIAN_CREW_BOOKING_MODE).toBe('confirm_myself')
  })

  it('confirms the current user when that mode is selected', () => {
    expect(
      technicianReservedCrewInsert('confirm_myself', 'period-1', 'user-1'),
    ).toEqual({
      time_period_id: 'period-1',
      user_id: 'user-1',
      status: 'confirmed',
      notes: null,
    })
  })

  it('leaves the slot open without a reserved_crew row', () => {
    expect(
      technicianReservedCrewInsert('open', 'period-1', 'user-1'),
    ).toBeNull()
  })

  it('leaves the slot open when there is no current user to confirm', () => {
    expect(
      technicianReservedCrewInsert('confirm_myself', 'period-1', null),
    ).toBeNull()
  })
})
