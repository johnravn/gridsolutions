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

/**
 * Who may change an existing member's role (set_company_user_role).
 * Employees can invite freelancers but cannot change roles.
 */
export function canChangeCompanyUserRoles({
  isGlobalSuperuser,
  companyRole,
}: {
  isGlobalSuperuser: boolean
  companyRole: CompanyRole | null
}): boolean {
  return (
    isGlobalSuperuser || companyRole === 'owner' || companyRole === 'super_user'
  )
}

/**
 * Role-assignment matrix shared with add_member_or_invite /
 * set_company_user_role (see migration restrict_company_role_assignment).
 *
 * - employee → freelancer
 * - company super_user → employee, freelancer
 * - owner / global superuser → any role
 */
export function canAssignCompanyRole({
  isGlobalSuperuser,
  companyRole,
  targetRole,
}: {
  isGlobalSuperuser: boolean
  companyRole: CompanyRole | null
  targetRole: CompanyRole
}): boolean {
  if (isGlobalSuperuser || companyRole === 'owner') return true
  if (companyRole === 'super_user') {
    return targetRole === 'employee' || targetRole === 'freelancer'
  }
  if (companyRole === 'employee') return targetRole === 'freelancer'
  return false
}

/** Whether the actor may set `targetRole` on a member who currently has `currentRole`. */
export function canChangeMemberRole({
  isGlobalSuperuser,
  companyRole,
  currentRole,
  targetRole,
}: {
  isGlobalSuperuser: boolean
  companyRole: CompanyRole | null
  currentRole: CompanyRole
  targetRole: CompanyRole
}): boolean {
  if (currentRole === targetRole) return false
  if (!canChangeCompanyUserRoles({ isGlobalSuperuser, companyRole })) {
    return false
  }
  if (
    (currentRole === 'owner' || currentRole === 'super_user') &&
    !isGlobalSuperuser &&
    companyRole !== 'owner'
  ) {
    return false
  }
  return canAssignCompanyRole({
    isGlobalSuperuser,
    companyRole,
    targetRole,
  })
}
