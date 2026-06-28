import { describe, expect, it } from 'vitest'
import {
  buildFreelancerVisibleJobIds,
  isFreelancerVisibleCrewBooking,
} from './freelancerCalendarVisibility'

describe('isFreelancerVisibleCrewBooking', () => {
  const invited = new Set(['tp-invited'])

  it('shows confirmed bookings', () => {
    expect(isFreelancerVisibleCrewBooking('confirmed', 'tp-1', invited)).toBe(
      true,
    )
  })

  it('shows planned bookings when invited', () => {
    expect(
      isFreelancerVisibleCrewBooking('planned', 'tp-invited', invited),
    ).toBe(true)
  })

  it('hides planned bookings without invite', () => {
    expect(isFreelancerVisibleCrewBooking('planned', 'tp-1', invited)).toBe(
      false,
    )
  })

  it('hides canceled bookings', () => {
    expect(isFreelancerVisibleCrewBooking('canceled', 'tp-1', invited)).toBe(
      false,
    )
  })

  it('does not treat legacy accepted status as confirmed', () => {
    expect(isFreelancerVisibleCrewBooking('accepted', 'tp-1', invited)).toBe(
      false,
    )
  })
})

describe('buildFreelancerVisibleJobIds', () => {
  it('collects jobs from confirmed crew rows and invite-only periods', () => {
    const jobIds = buildFreelancerVisibleJobIds({
      crewRows: [
        {
          time_period_id: 'tp-confirmed',
          user_id: 'user-1',
          status: 'confirmed',
        },
        {
          time_period_id: 'tp-planned',
          user_id: 'user-1',
          status: 'planned',
        },
        {
          time_period_id: 'tp-other',
          user_id: 'user-2',
          status: 'confirmed',
        },
      ],
      timePeriodJobById: new Map([
        ['tp-confirmed', 'job-a'],
        ['tp-planned', 'job-b'],
        ['tp-invite-only', 'job-c'],
        ['tp-other', 'job-d'],
      ]),
      invitedTimePeriodIds: new Set(['tp-planned', 'tp-invite-only']),
      userId: 'user-1',
    })

    expect(Array.from(jobIds).sort()).toEqual(['job-a', 'job-b', 'job-c'])
  })
})
