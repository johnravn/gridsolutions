import { describe, expect, it } from 'vitest'
import { crewInviteResponseKind } from './crewInviteResponse'

describe('crewInviteResponseKind', () => {
  it('maps accept aliases', () => {
    expect(crewInviteResponseKind('approved')).toBe('accepted')
    expect(crewInviteResponseKind('Accepted')).toBe('accepted')
  })

  it('maps decline aliases', () => {
    expect(crewInviteResponseKind('rejected')).toBe('declined')
    expect(crewInviteResponseKind('declined')).toBe('declined')
  })

  it('maps a filled role so extras see the job is taken', () => {
    expect(crewInviteResponseKind('role_filled')).toBe('filled')
    expect(crewInviteResponseKind('taken')).toBe('filled')
  })

  it('returns none without a response', () => {
    expect(crewInviteResponseKind(null)).toBe('none')
    expect(crewInviteResponseKind(undefined)).toBe('none')
    expect(crewInviteResponseKind('')).toBe('none')
  })
})
