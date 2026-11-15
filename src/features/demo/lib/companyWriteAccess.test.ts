import { describe, expect, it } from 'vitest'
import { resolveCompanyWriteAccess } from './companyWriteAccess'

describe('resolveCompanyWriteAccess', () => {
  it('marks freelancers read-only for role UI', () => {
    expect(
      resolveCompanyWriteAccess({
        companyRole: 'freelancer',
        isDemoMode: false,
      }),
    ).toEqual({
      canWrite: false,
      isReadOnly: true,
      isDemoReadOnly: false,
      isFreelancerReadOnly: true,
    })
  })

  it('keeps canWrite true in demo so explorers can click affordances', () => {
    expect(
      resolveCompanyWriteAccess({
        companyRole: 'owner',
        isDemoMode: true,
      }),
    ).toEqual({
      canWrite: true,
      isReadOnly: false,
      isDemoReadOnly: true,
      isFreelancerReadOnly: false,
    })
  })

  it('combines freelancer + demo flags without hiding demo via canWrite', () => {
    const access = resolveCompanyWriteAccess({
      companyRole: 'freelancer',
      isDemoMode: true,
    })
    expect(access.canWrite).toBe(false)
    expect(access.isDemoReadOnly).toBe(true)
    expect(access.isFreelancerReadOnly).toBe(true)
  })
})
