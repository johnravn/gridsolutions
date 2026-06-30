import { describe, expect, it } from 'vitest'
import { capabilitiesFor, canVisit, type Capability } from './permissions'

const ALL_CAPS: Array<Capability> = [
  'visit:home',
  'visit:inventory',
  'visit:vehicles',
  'visit:crew',
  'visit:jobs',
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
    expect(caps.has('visit:inventory')).toBe(true)
    expect(caps.has('visit:super')).toBe(false)
  })

  it('grants employee access without company settings', () => {
    const caps = capabilitiesFor({
      isGlobalSuperuser: false,
      companyRole: 'employee',
    })
    expect(caps.has('visit:jobs')).toBe(true)
    expect(caps.has('visit:company')).toBe(false)
    expect(caps.has('visit:inventory')).toBe(true)
  })

  it('limits freelancer to jobs among company modules', () => {
    const caps = capabilitiesFor({
      isGlobalSuperuser: false,
      companyRole: 'freelancer',
    })
    expect(caps.has('visit:jobs')).toBe(true)
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
