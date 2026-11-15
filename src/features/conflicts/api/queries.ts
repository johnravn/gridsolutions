import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { mergeEquipmentConflicts } from '../utils/mergeEquipmentConflicts'

export type PairConflictBase = {
  period_id_1: string
  period_id_2: string
  job_id_1: string | null
  job_id_2: string | null
  job_title_1: string | null
  job_title_2: string | null
  start_1: string
  end_1: string
  start_2: string
  end_2: string
  forced_1: boolean
  forced_2: boolean
}

export type CrewConflictRow = PairConflictBase & {
  user_id: string
  user_display_name: string | null
}

export type VehicleConflictRow = PairConflictBase & {
  vehicle_id: string
  vehicle_name: string | null
}

export type EquipmentConflictRow = {
  item_id: string
  item_name: string | null
  capacity: number
  total_reserved: number
  start_at: string
  end_at: string
  job_ids: Array<string> | null
  job_titles: Array<string> | null
  has_forced: boolean
}

export type GroupConflictRow = PairConflictBase & {
  group_id_1: string
  group_id_2: string
  group_name_1: string | null
  group_name_2: string | null
}

export type JobBookingConflicts = {
  crew: Array<CrewConflictRow>
  vehicles: Array<VehicleConflictRow>
  equipment: Array<EquipmentConflictRow>
  groups: Array<GroupConflictRow>
}

type CompanyConflictRpc =
  | 'get_conflicts_crew'
  | 'get_conflicts_vehicle'
  | 'get_conflicts_equipment'
  | 'get_conflicts_groups'

type CompanyConflictListKind = 'crew' | 'vehicle' | 'equipment' | 'groups'

const CONFLICT_LIST_STALE_MS = 5 * 60 * 1000

/**
 * Shared company conflict list factory. Kind + RPC name are the only
 * varying knowledge; equipment optionally maps rows through merge.
 *
 * Phase D: company-wide keys are intentionally not realtime-invalidated;
 * freshness is staleTime / remount. See invalidateScheduleQueries.
 */
function companyConflictListQuery<TRow>({
  kind,
  rpcName,
  companyId,
  from,
  to,
  mapRows,
}: {
  kind: CompanyConflictListKind
  rpcName: CompanyConflictRpc
  companyId: string
  from?: string | null
  to?: string | null
  mapRows?: (rows: Array<TRow>) => Array<TRow>
}) {
  return queryOptions<Array<TRow>>({
    queryKey: ['conflicts', kind, companyId, from ?? null, to ?? null],
    queryFn: async () => {
      if (!companyId) {
        throw new Error(`companyId is required for ${rpcName}`)
      }
      const { data, error } = await supabase.rpc(rpcName, {
        p_company_id: companyId,
        p_from: from ?? undefined,
        p_to: to ?? undefined,
      })
      if (error) throw error
      const rows = (data ?? []) as Array<TRow>
      return mapRows ? mapRows(rows) : rows
    },
    enabled: !!companyId,
    staleTime: CONFLICT_LIST_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function crewConflictsQuery({
  companyId,
  from,
  to,
}: {
  companyId: string
  from?: string | null
  to?: string | null
}) {
  return companyConflictListQuery<CrewConflictRow>({
    kind: 'crew',
    rpcName: 'get_conflicts_crew',
    companyId,
    from,
    to,
  })
}

export function vehicleConflictsQuery({
  companyId,
  from,
  to,
}: {
  companyId: string
  from?: string | null
  to?: string | null
}) {
  return companyConflictListQuery<VehicleConflictRow>({
    kind: 'vehicle',
    rpcName: 'get_conflicts_vehicle',
    companyId,
    from,
    to,
  })
}

export function equipmentConflictsQuery({
  companyId,
  from,
  to,
}: {
  companyId: string
  from?: string | null
  to?: string | null
}) {
  return companyConflictListQuery<EquipmentConflictRow>({
    kind: 'equipment',
    rpcName: 'get_conflicts_equipment',
    companyId,
    from,
    to,
    mapRows: mergeEquipmentConflicts,
  })
}

export function groupConflictsQuery({
  companyId,
  from,
  to,
}: {
  companyId: string
  from?: string | null
  to?: string | null
}) {
  return companyConflictListQuery<GroupConflictRow>({
    kind: 'groups',
    rpcName: 'get_conflicts_groups',
    companyId,
    from,
    to,
  })
}

export function jobBookingConflictsQuery({
  jobId,
  from,
  to,
}: {
  jobId: string
  from?: string | null
  to?: string | null
}) {
  return queryOptions<JobBookingConflicts>({
    queryKey: ['conflicts', 'job', jobId, from ?? null, to ?? null],
    queryFn: async () => {
      if (!jobId) {
        throw new Error('jobId is required for get_job_booking_conflicts')
      }
      const { data, error } = await supabase.rpc('get_job_booking_conflicts', {
        p_job_id: jobId,
        p_from: from ?? undefined,
        p_to: to ?? undefined,
      })
      if (error) throw error
      const parsed = (data ?? {
        crew: [],
        vehicles: [],
        equipment: [],
        groups: [],
      }) as JobBookingConflicts
      return {
        crew: parsed.crew ?? [],
        vehicles: parsed.vehicles ?? [],
        equipment: mergeEquipmentConflicts(parsed.equipment ?? []),
        groups: parsed.groups ?? [],
      }
    },
    enabled: !!jobId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
