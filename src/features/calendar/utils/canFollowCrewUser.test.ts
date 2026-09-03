import { describe, expect, it } from 'vitest'
import { canFollowCrewUser, crewDisplayName } from './canFollowCrewUser'

describe('canFollowCrewUser', () => {
  it('allows owner and super_user to follow anyone except themselves', () => {
    expect(
      canFollowCrewUser({
        subscriberUserId: 'owner-1',
        subscriberRole: 'owner',
        targetUserId: 'emp-1',
        targetRole: 'employee',
      }),
    ).toBe(true)
    expect(
      canFollowCrewUser({
        subscriberUserId: 'su-1',
        subscriberRole: 'super_user',
        targetUserId: 'free-1',
        targetRole: 'freelancer',
      }),
    ).toBe(true)
    expect(
      canFollowCrewUser({
        subscriberUserId: 'owner-1',
        subscriberRole: 'owner',
        targetUserId: 'owner-1',
        targetRole: 'owner',
      }),
    ).toBe(false)
  })

  it('allows employees to follow members except the owner and themselves', () => {
    expect(
      canFollowCrewUser({
        subscriberUserId: 'emp-1',
        subscriberRole: 'employee',
        targetUserId: 'emp-2',
        targetRole: 'employee',
      }),
    ).toBe(true)
    expect(
      canFollowCrewUser({
        subscriberUserId: 'emp-1',
        subscriberRole: 'employee',
        targetUserId: 'free-1',
        targetRole: 'freelancer',
      }),
    ).toBe(true)
    expect(
      canFollowCrewUser({
        subscriberUserId: 'emp-1',
        subscriberRole: 'employee',
        targetUserId: 'owner-1',
        targetRole: 'owner',
      }),
    ).toBe(false)
  })

  it('never allows freelancers to follow another person', () => {
    expect(
      canFollowCrewUser({
        subscriberUserId: 'free-1',
        subscriberRole: 'freelancer',
        targetUserId: 'emp-1',
        targetRole: 'employee',
      }),
    ).toBe(false)
  })
})

describe('crewDisplayName', () => {
  it('prefers display_name, then first+last, then email', () => {
    expect(
      crewDisplayName({
        display_name: 'Pat Lead',
        first_name: 'Pat',
        last_name: 'Lead',
        email: 'pat@example.com',
      }),
    ).toBe('Pat Lead')
    expect(
      crewDisplayName({
        display_name: null,
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
      }),
    ).toBe('Ada Lovelace')
    expect(
      crewDisplayName({
        display_name: '  ',
        first_name: null,
        last_name: null,
        email: 'ada@example.com',
      }),
    ).toBe('ada@example.com')
  })
})
