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
import { conflictAttentionBounds } from '../utils/conflictAttentionBounds'
import {
  keepAttentionEquipmentConflicts,
  keepAttentionPairConflicts,
} from '../utils/filterConflictsByProjectLead'
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

  const { from, to } = React.useMemo(() => {
    void companyId
    return conflictAttentionBounds()
  }, [companyId])

  const { data: crewConflicts = [] } = useQuery({
    ...crewConflictsQuery({
      companyId: companyId ?? '',
      from,
      to,
    }),
    enabled: shouldFetchConflicts,
  })
  const { data: vehicleConflicts = [] } = useQuery({
    ...vehicleConflictsQuery({
      companyId: companyId ?? '',
      from,
      to,
    }),
    enabled: shouldFetchConflicts,
  })
  const { data: equipmentConflicts = [] } = useQuery({
    ...equipmentConflictsQuery({
      companyId: companyId ?? '',
      from,
      to,
    }),
    enabled: shouldFetchConflicts,
  })
  const { data: groupConflicts = [] } = useQuery({
    ...groupConflictsQuery({
      companyId: companyId ?? '',
      from,
      to,
    }),
    enabled: shouldFetchConflicts,
  })

  return React.useMemo(() => {
    if (projectLeadJobIds.length === 0) return 0
    const { attentionNow } = conflictAttentionBounds()
    return countProjectLeadConflicts(
      buildConflictCards(
        keepAttentionPairConflicts(crewConflicts, attentionNow),
        keepAttentionPairConflicts(vehicleConflicts, attentionNow),
        keepAttentionEquipmentConflicts(equipmentConflicts, attentionNow),
        keepAttentionPairConflicts(groupConflicts, attentionNow),
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
