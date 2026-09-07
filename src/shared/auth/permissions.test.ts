import { describe, expect, it } from 'vitest'
import {
  capabilitiesFor,
  canAssignCompanyRole,
  canChangeCompanyUserRoles,
  canChangeMemberRole,
  canVisit,
  type Capability,
} from './permissions'

const ALL_CAPS: Array<Capability> = [
  'visit:home',
  'visit:inventory',
  'visit:vehicles',
  'visit:crew',
  'visit:jobs',
  'visit:conflicts',
  'visit:calendar',
  'visit:logging',
  'visit:customers',
  'visit:latest',
  'visit:matters',
  'visit:company',
  'visit:profile',
  'visit:super',
]

describe('capabilitiesFor', () => {
  it('grants all capabilities to global superuser', () => {
    const caps = capabilitiesFor({
      isGlobalSuperuser: true,
      companyRole: null,
    })
    for (const cap of ALL_CAPS) {
      expect(caps.has(cap)).toBe(true)
    }
  })

  it('grants only generic pages without company role', () => {
    const caps = capabilitiesFor({
      isGlobalSuperuser: false,
      companyRole: null,
    })
    expect(caps.has('visit:home')).toBe(true)
    expect(caps.has('visit:jobs')).toBe(false)
    expect(caps.has('visit:company')).toBe(false)
  })

  it('grants full company access to owner', () => {
    const caps = capabilitiesFor({
      isGlobalSuperuser: false,
      companyRole: 'owner',
    })
    expect(caps.has('visit:company')).toBe(true)
    expect(caps.has('visit:jobs')).toBe(true)
    expect(caps.has('visit:conflicts')).toBe(true)
    expect(caps.has('visit:inventory')).toBe(true)
    expect(caps.has('visit:super')).toBe(false)
  })

  it('grants employee access without company settings', () => {
    const caps = capabilitiesFor({
      isGlobalSuperuser: false,
      companyRole: 'employee',
    })
    expect(caps.has('visit:jobs')).toBe(true)
    expect(caps.has('visit:conflicts')).toBe(true)
    expect(caps.has('visit:company')).toBe(false)
    expect(caps.has('visit:inventory')).toBe(true)
  })

  it('limits freelancer to jobs among company modules', () => {
    const caps = capabilitiesFor({
      isGlobalSuperuser: false,
      companyRole: 'freelancer',
    })
    expect(caps.has('visit:jobs')).toBe(true)
    expect(caps.has('visit:conflicts')).toBe(false)
    expect(caps.has('visit:inventory')).toBe(false)
    expect(caps.has('visit:crew')).toBe(false)
    expect(caps.has('visit:vehicles')).toBe(false)
    expect(caps.has('visit:logging')).toBe(false)
    expect(caps.has('visit:customers')).toBe(false)
    expect(caps.has('visit:calendar')).toBe(true)
  })

  it('grants superuser visit:super only to global superuser', () => {
    expect(
      capabilitiesFor({
        isGlobalSuperuser: true,
        companyRole: 'owner',
      }).has('visit:super'),
    ).toBe(true)
    expect(
      capabilitiesFor({
        isGlobalSuperuser: false,
        companyRole: 'owner',
      }).has('visit:super'),
    ).toBe(false)
  })
})

describe('canVisit', () => {
  it('checks membership in capability set', () => {
    const caps = capabilitiesFor({
      isGlobalSuperuser: false,
      companyRole: 'freelancer',
    })
    expect(canVisit(caps, 'visit:jobs')).toBe(true)
    expect(canVisit(caps, 'visit:inventory')).toBe(false)
  })
})

describe('canAssignCompanyRole', () => {
  it('lets employees invite only freelancers', () => {
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'employee',
        targetRole: 'freelancer',
      }),
    ).toBe(true)
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'employee',
        targetRole: 'employee',
      }),
    ).toBe(false)
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'employee',
        targetRole: 'owner',
      }),
    ).toBe(false)
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'employee',
        targetRole: 'super_user',
      }),
    ).toBe(false)
  })

  it('lets company super_user assign employee and freelancer only', () => {
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'super_user',
        targetRole: 'employee',
      }),
    ).toBe(true)
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'super_user',
        targetRole: 'freelancer',
      }),
    ).toBe(true)
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'super_user',
        targetRole: 'owner',
      }),
    ).toBe(false)
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'super_user',
        targetRole: 'super_user',
      }),
    ).toBe(false)
  })

  it('lets owner and global superuser assign any role', () => {
    for (const targetRole of [
      'owner',
      'employee',
      'freelancer',
      'super_user',
    ] as const) {
      expect(
        canAssignCompanyRole({
          isGlobalSuperuser: false,
          companyRole: 'owner',
          targetRole,
        }),
      ).toBe(true)
      expect(
        canAssignCompanyRole({
          isGlobalSuperuser: true,
          companyRole: 'freelancer',
          targetRole,
        }),
      ).toBe(true)
    }
  })

  it('denies freelancers and callers without a company role', () => {
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: 'freelancer',
        targetRole: 'freelancer',
      }),
    ).toBe(false)
    expect(
      canAssignCompanyRole({
        isGlobalSuperuser: false,
        companyRole: null,
        targetRole: 'employee',
      }),
    ).toBe(false)
  })
})

describe('canChangeCompanyUserRoles', () => {
  it('allows owner, company super_user, and global superuser', () => {
    expect(
      canChangeCompanyUserRoles({
        isGlobalSuperuser: false,
        companyRole: 'owner',
      }),
    ).toBe(true)
    expect(
      canChangeCompanyUserRoles({
        isGlobalSuperuser: false,
        companyRole: 'super_user',
      }),
    ).toBe(true)
    expect(
      canChangeCompanyUserRoles({
        isGlobalSuperuser: true,
        companyRole: 'employee',
      }),
    ).toBe(true)
  })

  it('denies employees and freelancers', () => {
    expect(
      canChangeCompanyUserRoles({
        isGlobalSuperuser: false,
        companyRole: 'employee',
      }),
    ).toBe(false)
    expect(
      canChangeCompanyUserRoles({
        isGlobalSuperuser: false,
        companyRole: 'freelancer',
      }),
    ).toBe(false)
  })
})

describe('canChangeMemberRole', () => {
  it('blocks employees from changing anyone', () => {
    expect(
      canChangeMemberRole({
        isGlobalSuperuser: false,
        companyRole: 'employee',
        currentRole: 'freelancer',
        targetRole: 'freelancer',
      }),
    ).toBe(false)
    expect(
      canChangeMemberRole({
        isGlobalSuperuser: false,
        companyRole: 'employee',
        currentRole: 'freelancer',
        targetRole: 'owner',
      }),
    ).toBe(false)
  })

  it('blocks company super_user from promoting to owner or editing owners', () => {
    expect(
      canChangeMemberRole({
        isGlobalSuperuser: false,
        companyRole: 'super_user',
        currentRole: 'freelancer',
        targetRole: 'owner',
      }),
    ).toBe(false)
    expect(
      canChangeMemberRole({
        isGlobalSuperuser: false,
        companyRole: 'super_user',
        currentRole: 'owner',
        targetRole: 'employee',
      }),
    ).toBe(false)
    expect(
      canChangeMemberRole({
        isGlobalSuperuser: false,
        companyRole: 'super_user',
        currentRole: 'freelancer',
        targetRole: 'employee',
      }),
    ).toBe(true)
  })

  it('lets owner change employee to owner', () => {
    expect(
      canChangeMemberRole({
        isGlobalSuperuser: false,
        companyRole: 'owner',
        currentRole: 'employee',
        targetRole: 'owner',
      }),
    ).toBe(true)
  })
})
