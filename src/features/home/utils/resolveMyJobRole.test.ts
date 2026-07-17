import { describe, expect, it } from 'vitest'
import { myJobRoleBadge, resolveMyJobRole } from './resolveMyJobRole'

describe('resolveMyJobRole', () => {
  it('returns project_lead when user is lead only', () => {
    expect(
      resolveMyJobRole({
        userId: 'u1',
        projectLeadUserId: 'u1',
        isCrew: false,
      }),
    ).toBe('project_lead')
  })

  it('returns crew when user is crew only', () => {
    expect(
      resolveMyJobRole({
        userId: 'u1',
        projectLeadUserId: 'u2',
        isCrew: true,
      }),
    ).toBe('crew')
  })

  it('returns both when user is lead and crew', () => {
    expect(
      resolveMyJobRole({
        userId: 'u1',
        projectLeadUserId: 'u1',
        isCrew: true,
      }),
    ).toBe('both')
  })

  it('returns null when not involved', () => {
    expect(
      resolveMyJobRole({
        userId: 'u1',
        projectLeadUserId: 'u2',
        isCrew: false,
      }),
    ).toBeNull()
  })
})

describe('myJobRoleBadge', () => {
  it('maps roles to badge labels', () => {
    expect(myJobRoleBadge('crew')?.label).toBe('Crew')
    expect(myJobRoleBadge('project_lead')?.label).toBe('Lead')
    expect(myJobRoleBadge('both')?.label).toBe('Lead + Crew')
    expect(myJobRoleBadge(null)).toBeNull()
  })
})
