export type CompanyWriteAccessInput = {
  companyRole: string | null | undefined
  isDemoMode: boolean
}

export type CompanyWriteAccess = {
  canWrite: boolean
  isReadOnly: boolean
  isDemoReadOnly: boolean
  isFreelancerReadOnly: boolean
}

/**
 * Role-based UI write affordances.
 *
 * Demo mode does not flip `canWrite`/`isReadOnly` — explorers keep seeing
 * buttons; mutations are blocked by `wrapSupabaseClientForDemo`. Surfaces that
 * must hide write UI in demo should also check `isDemoReadOnly`.
 */
export function resolveCompanyWriteAccess({
  companyRole,
  isDemoMode,
}: CompanyWriteAccessInput): CompanyWriteAccess {
  const isFreelancerReadOnly = companyRole === 'freelancer'
  return {
    canWrite: !isFreelancerReadOnly,
    isReadOnly: isFreelancerReadOnly,
    isDemoReadOnly: isDemoMode,
    isFreelancerReadOnly,
  }
}
