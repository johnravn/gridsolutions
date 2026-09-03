// src/shared/auth/permissions.ts
export type CompanyRole = 'owner' | 'employee' | 'freelancer' | 'super_user'
export type Capability =
  | 'visit:home'
  | 'visit:inventory'
  | 'visit:vehicles'
  | 'visit:crew'
  | 'visit:jobs'
  | 'visit:conflicts'
  | 'visit:calendar'
  | 'visit:logging'
  | 'visit:customers'
  | 'visit:latest'
  | 'visit:matters'
  | 'visit:company'
  | 'visit:profile'
  | 'visit:super'

export type CapabilitySet = Set<Capability>

export function capabilitiesFor({
  isGlobalSuperuser,
  companyRole,
}: {
  isGlobalSuperuser: boolean
  companyRole: CompanyRole | null // null when no company selected
}): CapabilitySet {
  const caps = new Set<Capability>([
    'visit:home',
    'visit:calendar',
    'visit:matters',
    'visit:profile',
  ])

  // Global superuser: can do everything including /super
  if (isGlobalSuperuser) {
    ;(
      [
        'visit:super',
        'visit:company',
        'visit:inventory',
        'visit:vehicles',
        'visit:crew',
        'visit:jobs',
        'visit:conflicts',
        'visit:logging',
        'visit:customers',
        'visit:latest',
      ] as Array<Capability>
    ).forEach((c) => caps.add(c))
    return caps
  }

  if (!companyRole) {
    // Not in a company context: allow only generic pages (already added above)
    return caps
  }

  const allowAllCompany =
    companyRole === 'owner' || companyRole === 'super_user'
  if (allowAllCompany) {
    ;(
      [
        'visit:company',
        'visit:inventory',
        'visit:vehicles',
        'visit:crew',
        'visit:jobs',
        'visit:conflicts',
        'visit:logging',
        'visit:customers',
        'visit:latest',
      ] as Array<Capability>
    ).forEach((c) => caps.add(c))
    return caps
  }

  if (companyRole === 'employee') {
    // everything but company settings
    ;(
      [
        'visit:inventory',
        'visit:vehicles',
        'visit:crew',
        'visit:jobs',
        'visit:conflicts',
        'visit:logging',
        'visit:customers',
        'visit:latest',
      ] as Array<Capability>
    ).forEach((c) => caps.add(c))
    return caps
  }

  if (companyRole === 'freelancer') {
    // blocked: inventory, vehicles, crew
    // (calendar, matters, profile, home, jobs already allowed)
    caps.add('visit:jobs')
    return caps
  }

  return caps
}

export function canVisit(caps: CapabilitySet, need: Capability) {
  return caps.has(need)
}
