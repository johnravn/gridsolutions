import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TECHNICIAN_CREW_BOOKING_MODE,
  TECHNICIAN_CREW_BOOKING_TITLE,
  technicianCrewPeriodInsert,
  technicianReservedCrewInsert,
  technicianCrewBookingFromCheckedValues,
  toggleTechnicianCrewBooking,
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

  it('defaults to no technician crew booking selected', () => {
    expect(DEFAULT_TECHNICIAN_CREW_BOOKING_MODE).toBeNull()
  })

  it('toggles a selected radio card back to none', () => {
    expect(toggleTechnicianCrewBooking(null, 'open')).toBe('open')
    expect(toggleTechnicianCrewBooking('open', 'open')).toBeNull()
    expect(toggleTechnicianCrewBooking('open', 'confirm_myself')).toBe(
      'confirm_myself',
    )
    expect(toggleTechnicianCrewBooking('confirm_myself', 'open')).toBe('open')
    expect(
      toggleTechnicianCrewBooking('confirm_myself', 'confirm_myself'),
    ).toBeNull()
    expect(toggleTechnicianCrewBooking('open', 'other')).toBe('open')
  })

  it('keeps at most one checked crew booking card', () => {
    expect(technicianCrewBookingFromCheckedValues(null, [])).toBeNull()
    expect(technicianCrewBookingFromCheckedValues(null, ['open'])).toBe('open')
    expect(technicianCrewBookingFromCheckedValues('open', [])).toBeNull()
    expect(
      technicianCrewBookingFromCheckedValues('open', [
        'open',
        'confirm_myself',
      ]),
    ).toBe('confirm_myself')
    expect(
      technicianCrewBookingFromCheckedValues('confirm_myself', [
        'confirm_myself',
        'open',
      ]),
    ).toBe('open')
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
