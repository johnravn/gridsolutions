import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  
  
  
  
  crewConflictsQuery,
  equipmentConflictsQuery,
  groupConflictsQuery,
  vehicleConflictsQuery
} from '../api/queries'
import { conflictAttentionBounds } from '../utils/conflictAttentionBounds'
import {
  keepAttentionEquipmentConflicts,
  keepAttentionPairConflicts,
} from '../utils/filterConflictsByProjectLead'
import { buildConflictCards } from '../utils/conflictItems'
import type {CrewConflictRow, EquipmentConflictRow, GroupConflictRow, VehicleConflictRow} from '../api/queries';
import type { ConflictCardItem } from '../utils/conflictItems'

/**
 * Single owner for company-wide conflict RPC orchestration + attention window.
 * Page, sidebar badge, and Home should consume this instead of four copy-pasted useQueries.
 *
 * Contract: this is the **persisted inventory** engine (existing bookings + forced flags).
 * Pre-insert preview lives in `overlapChecks.ts` / `equipmentConflictCheck.ts` — keep both
 * in sync when changing “what counts as a conflict.”
 */
export function useCompanyConflictBundle({
  enabled = true,
}: {
  enabled?: boolean
} = {}): {
  from: string
  to: null
  attentionNow: Date
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  groupConflicts: Array<GroupConflictRow>
  isLoading: boolean
  attentionCards: Array<ConflictCardItem>
} {
  const { companyId } = useCompany()

  // Clock-based window; companyId is the session key so switching companies refreshes `from`.
  const { from, to, attentionNow } = React.useMemo(
    () => conflictAttentionBounds(companyId ? new Date() : new Date()),
    [companyId],
  )

  const queryEnabled = !!companyId && enabled

  const { data: crewConflicts = [], isLoading: crewLoading } = useQuery({
    ...crewConflictsQuery({
      companyId: companyId ?? '',
      from,
      to,
    }),
    enabled: queryEnabled,
  })
  const { data: vehicleConflicts = [], isLoading: vehicleLoading } = useQuery({
    ...vehicleConflictsQuery({
      companyId: companyId ?? '',
      from,
      to,
    }),
    enabled: queryEnabled,
  })
  const { data: equipmentConflicts = [], isLoading: equipmentLoading } =
    useQuery({
      ...equipmentConflictsQuery({
        companyId: companyId ?? '',
        from,
        to,
      }),
      enabled: queryEnabled,
    })
  const { data: groupConflicts = [], isLoading: groupLoading } = useQuery({
    ...groupConflictsQuery({
      companyId: companyId ?? '',
      from,
      to,
    }),
    enabled: queryEnabled,
  })

  const isLoading =
    queryEnabled &&
    (crewLoading || vehicleLoading || equipmentLoading || groupLoading)

  const attentionCards = React.useMemo(
    () =>
      buildConflictCards(
        keepAttentionPairConflicts(crewConflicts, attentionNow),
        keepAttentionPairConflicts(vehicleConflicts, attentionNow),
        keepAttentionEquipmentConflicts(equipmentConflicts, attentionNow),
        keepAttentionPairConflicts(groupConflicts, attentionNow),
      ),
    [
      crewConflicts,
      vehicleConflicts,
      equipmentConflicts,
      groupConflicts,
      attentionNow,
    ],
  )

  return {
    from,
    to,
    attentionNow,
    crewConflicts,
    vehicleConflicts,
    equipmentConflicts,
    groupConflicts,
    isLoading,
    attentionCards,
  }
}
