import { useQuery } from '@tanstack/react-query'
import { useAuthz } from '@shared/auth/useAuthz'
import { canVisit } from '@shared/auth/permissions'
import { useCompany } from '@shared/companies/CompanyProvider'
import { projectLeadJobIdsQuery } from '@features/home/api/projectLeadJobIdsQuery'
import { countProjectLeadConflicts } from '../utils/conflictItems'
import { useCompanyConflictBundle } from './useCompanyConflictBundle'

export function useProjectLeadConflictCount() {
  const { companyId } = useCompany()
  const { userId, caps } = useAuthz()
  const canSeeConflicts = canVisit(caps, 'visit:conflicts')

  const { data: projectLeadJobIds = [] } = useQuery({
    ...projectLeadJobIdsQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId && canSeeConflicts,
  })

  const shouldFetchConflicts =
    !!companyId && canSeeConflicts && projectLeadJobIds.length > 0

  const { attentionCards } = useCompanyConflictBundle({
    enabled: shouldFetchConflicts,
  })

  if (projectLeadJobIds.length === 0) return 0
  return countProjectLeadConflicts(attentionCards, projectLeadJobIds)
}
