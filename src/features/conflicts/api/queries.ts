import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { mergeEquipmentConflicts } from '../utils/mergeEquipmentConflicts'

export type CrewConflictRow = {
  user_id: string
  user_display_name: string | null
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

export type VehicleConflictRow = {
  vehicle_id: string
  vehicle_name: string | null
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

export type JobBookingConflicts = {
  crew: Array<CrewConflictRow>
  vehicles: Array<VehicleConflictRow>
  equipment: Array<EquipmentConflictRow>
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
  return queryOptions<Array<CrewConflictRow>>({
    queryKey: ['conflicts', 'crew', companyId, from ?? null, to ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conflicts_crew', {
        p_company_id: companyId,
        p_from: from ?? undefined,
        p_to: to ?? undefined,
      })
      if (error) throw error
      return (data ?? []) as Array<CrewConflictRow>
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
  return queryOptions<Array<VehicleConflictRow>>({
    queryKey: ['conflicts', 'vehicle', companyId, from ?? null, to ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conflicts_vehicle', {
        p_company_id: companyId,
        p_from: from ?? undefined,
        p_to: to ?? undefined,
      })
      if (error) throw error
      return (data ?? []) as Array<VehicleConflictRow>
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
  return queryOptions<Array<EquipmentConflictRow>>({
    queryKey: ['conflicts', 'equipment', companyId, from ?? null, to ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conflicts_equipment', {
        p_company_id: companyId,
        p_from: from ?? undefined,
        p_to: to ?? undefined,
      })
      if (error) throw error
      return mergeEquipmentConflicts(
        (data ?? []) as Array<EquipmentConflictRow>,
      )
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
      }) as JobBookingConflicts
      return {
        crew: parsed.crew ?? [],
        vehicles: parsed.vehicles ?? [],
        equipment: mergeEquipmentConflicts(parsed.equipment ?? []),
      }
    },
    enabled: !!jobId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
