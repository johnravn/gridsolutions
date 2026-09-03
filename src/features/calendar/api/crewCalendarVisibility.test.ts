import { describe, expect, it } from 'vitest'
import {
  buildPendingInviteUserIdsByPeriod,
  companyCrewPeriodIsVisible,
  eventHasPendingInviteLabel,
  isActiveCrewBooking,
  isOpenCrewInviteStatus,
  isPendingCrewInvitation,
  pendingInviteUserIdsForPeriod,
} from './crewCalendarVisibility'

describe('isOpenCrewInviteStatus', () => {
  it('treats accepted and declined as closed', () => {
    expect(isOpenCrewInviteStatus('accepted')).toBe(false)
    expect(isOpenCrewInviteStatus('declined')).toBe(false)
  })

  it('treats other statuses as open', () => {
    expect(isOpenCrewInviteStatus('pending')).toBe(true)
    expect(isOpenCrewInviteStatus('viewed')).toBe(true)
    expect(isOpenCrewInviteStatus(null)).toBe(true)
  })
})

describe('isActiveCrewBooking', () => {
  it('keeps confirmed and planned, drops canceled', () => {
    expect(isActiveCrewBooking('confirmed')).toBe(true)
    expect(isActiveCrewBooking('planned')).toBe(true)
    expect(isActiveCrewBooking('canceled')).toBe(false)
  })
})

describe('buildPendingInviteUserIdsByPeriod', () => {
  it('maps unanswered invites per period and user', () => {
    const map = buildPendingInviteUserIdsByPeriod([
      {
        time_period_id: 'tp-1',
        matter_recipients: [
          { user_id: 'u1', status: 'pending' },
          { user_id: 'u2', status: 'accepted' },
        ],
      },
      {
        time_period_id: 'tp-2',
        matter_recipients: { user_id: 'u3', status: 'viewed' },
      },
      {
        time_period_id: 'tp-3',
        matter_recipients: [{ user_id: 'u4', status: 'declined' }],
      },
    ])

    expect(Array.from(map.get('tp-1') ?? [])).toEqual(['u1'])
    expect(Array.from(map.get('tp-2') ?? [])).toEqual(['u3'])
    expect(map.has('tp-3')).toBe(false)
  })
})

describe('isPendingCrewInvitation', () => {
  const pending = new Map<string, Set<string>>([['tp-1', new Set(['u1'])]])

  it('requires planned status and an open invite', () => {
    expect(isPendingCrewInvitation('planned', 'u1', 'tp-1', pending)).toBe(true)
    expect(isPendingCrewInvitation('confirmed', 'u1', 'tp-1', pending)).toBe(
      false,
    )
    expect(isPendingCrewInvitation('planned', 'u2', 'tp-1', pending)).toBe(
      false,
    )
  })
})

describe('pendingInviteUserIdsForPeriod', () => {
  it('only includes planned bookings with open invites', () => {
    const pending = new Map<string, Set<string>>([
      ['tp-1', new Set(['u1', 'u2'])],
    ])
    expect(
      pendingInviteUserIdsForPeriod(
        [
          { user_id: 'u1', status: 'planned' },
          { user_id: 'u2', status: 'confirmed' },
          { user_id: 'u3', status: 'planned' },
        ],
        'tp-1',
        pending,
      ),
    ).toEqual(['u1'])
  })
})

describe('companyCrewPeriodIsVisible', () => {
  it('hides periods where every booking is canceled', () => {
    expect(
      companyCrewPeriodIsVisible([
        { status: 'canceled' },
        { status: 'canceled' },
      ]),
    ).toBe(false)
  })

  it('keeps periods with at least one active booking', () => {
    expect(
      companyCrewPeriodIsVisible([
        { status: 'canceled' },
        { status: 'planned' },
      ]),
    ).toBe(true)
  })

  it('keeps empty periods (no reserved_crew yet)', () => {
    expect(companyCrewPeriodIsVisible([])).toBe(true)
  })
})

describe('eventHasPendingInviteLabel', () => {
  it('labels crew events with any pending invite when no focus user', () => {
    expect(
      eventHasPendingInviteLabel({
        category: 'crew',
        pendingInviteUserIds: ['u1'],
        viewerUserId: 'viewer',
        focusUserId: null,
      }),
    ).toBe(true)
  })

  it('labels crew events only for the focused user when set', () => {
    expect(
      eventHasPendingInviteLabel({
        category: 'crew',
        pendingInviteUserIds: ['u1'],
        focusUserId: 'u1',
      }),
    ).toBe(true)
    expect(
      eventHasPendingInviteLabel({
        category: 'crew',
        pendingInviteUserIds: ['u1'],
        focusUserId: 'u2',
      }),
    ).toBe(false)
  })

  it('labels job duration only for the viewer', () => {
    expect(
      eventHasPendingInviteLabel({
        category: 'program',
        pendingInviteUserIds: ['u1', 'viewer'],
        viewerUserId: 'viewer',
        focusUserId: null,
      }),
    ).toBe(true)
    expect(
      eventHasPendingInviteLabel({
        category: 'program',
        pendingInviteUserIds: ['u1'],
        viewerUserId: 'viewer',
        focusUserId: null,
      }),
    ).toBe(false)
  })
})
