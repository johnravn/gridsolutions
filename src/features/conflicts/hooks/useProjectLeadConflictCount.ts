import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthz } from '@shared/auth/useAuthz'
import { canVisit } from '@shared/auth/permissions'
import { useCompany } from '@shared/companies/CompanyProvider'
import { projectLeadJobIdsQuery } from '@features/home/api/projectLeadJobIdsQuery'
import {
  crewConflictsQuery,
  equipmentConflictsQuery,
  groupConflictsQuery,
  vehicleConflictsQuery,
} from '../api/queries'
import {
  buildConflictCards,
  countProjectLeadConflicts,
} from '../utils/conflictItems'

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

  const { data: crewConflicts = [] } = useQuery({
    ...crewConflictsQuery({
      companyId: companyId ?? '',
      from: null,
      to: null,
    }),
    enabled: shouldFetchConflicts,
  })
  const { data: vehicleConflicts = [] } = useQuery({
    ...vehicleConflictsQuery({
      companyId: companyId ?? '',
      from: null,
      to: null,
    }),
    enabled: shouldFetchConflicts,
  })
  const { data: equipmentConflicts = [] } = useQuery({
    ...equipmentConflictsQuery({
      companyId: companyId ?? '',
      from: null,
      to: null,
    }),
    enabled: shouldFetchConflicts,
  })
  const { data: groupConflicts = [] } = useQuery({
    ...groupConflictsQuery({
      companyId: companyId ?? '',
      from: null,
      to: null,
    }),
    enabled: shouldFetchConflicts,
  })

  return React.useMemo(() => {
    if (projectLeadJobIds.length === 0) return 0
    return countProjectLeadConflicts(
      buildConflictCards(
        crewConflicts,
        vehicleConflicts,
        equipmentConflicts,
        groupConflicts,
      ),
      projectLeadJobIds,
    )
  }, [
    crewConflicts,
    vehicleConflicts,
    equipmentConflicts,
    groupConflicts,
    projectLeadJobIds,
  ])
}
