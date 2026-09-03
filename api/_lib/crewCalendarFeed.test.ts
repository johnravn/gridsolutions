import { describe, expect, it } from 'vitest'
import {
  crewFeedEventTitle,
  crewPersonalEventTitle,
  isCrewFeedBookingVisible,
  pendingInvitePeriodIdsFromMatters,
} from './crewCalendarFeed'

describe('isCrewFeedBookingVisible', () => {
  it('includes confirmed bookings even without an invite', () => {
    expect(isCrewFeedBookingVisible('confirmed', false)).toBe(true)
  })

  it('includes planned bookings with a pending invite', () => {
    expect(isCrewFeedBookingVisible('planned', true)).toBe(true)
  })

  it('excludes planned bookings that were never invited', () => {
    expect(isCrewFeedBookingVisible('planned', false)).toBe(false)
  })

  it('excludes canceled and declined bookings', () => {
    expect(isCrewFeedBookingVisible('canceled', true)).toBe(false)
    expect(isCrewFeedBookingVisible('canceled', false)).toBe(false)
  })
})

describe('crewFeedEventTitle', () => {
  it('labels unanswered invitations', () => {
    expect(crewFeedEventTitle('Load-in', 'planned')).toBe(
      'PENDING INVITATION: Load-in',
    )
  })

  it('keeps confirmed crew titles without a pending label', () => {
    expect(crewFeedEventTitle('Load-in', 'confirmed')).toBe('CREW: Load-in')
  })

  it('falls back when the job title is empty', () => {
    expect(crewFeedEventTitle('  ', 'confirmed')).toBe('CREW: Event')
  })

  it("prefixes someone else's feed with their name", () => {
    expect(crewFeedEventTitle('Load-in', 'confirmed', 'Ada Lovelace')).toBe(
      'CREW Ada Lovelace: Load-in',
    )
    expect(crewFeedEventTitle('Load-in', 'planned', 'Ada Lovelace')).toBe(
      'CREW Ada Lovelace PENDING INVITATION: Load-in',
    )
  })
})

describe('crewPersonalEventTitle', () => {
  it('tags personal holds after CREW', () => {
    expect(crewPersonalEventTitle('Accounting')).toBe(
      'CREW PERSONAL: Accounting',
    )
    expect(crewPersonalEventTitle('Accounting', 'Ada Lovelace')).toBe(
      'CREW Ada Lovelace PERSONAL: Accounting',
    )
  })
})

describe('pendingInvitePeriodIdsFromMatters', () => {
  it('keeps periods with an unanswered invite', () => {
    const ids = pendingInvitePeriodIdsFromMatters([
      {
        time_period_id: 'tp-pending',
        matter_recipients: [{ status: 'pending' }],
      },
      {
        time_period_id: 'tp-viewed',
        matter_recipients: { status: 'viewed' },
      },
      {
        time_period_id: 'tp-accepted',
        matter_recipients: [{ status: 'accepted' }],
      },
      {
        time_period_id: 'tp-declined',
        matter_recipients: [{ status: 'declined' }],
      },
    ])
    expect(Array.from(ids).sort()).toEqual(['tp-pending', 'tp-viewed'])
  })
})
