import { useAuthz } from '@shared/auth/useAuthz'
import { useDemoMode } from './useDemoMode'

export function useCompanyWriteAccess() {
  const { companyRole } = useAuthz()
  const { isDemoMode } = useDemoMode()

  const isFreelancerReadOnly = companyRole === 'freelancer'
  const isReadOnly = isFreelancerReadOnly
  const canWrite = !isFreelancerReadOnly

  return {
    canWrite,
    isReadOnly,
    isDemoReadOnly: isDemoMode,
    isFreelancerReadOnly,
  }
}
