import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

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
  return queryOptions<CrewConflictRow[]>({
    queryKey: ['conflicts', 'crew', companyId, from ?? null, to ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conflicts_crew', {
        p_company_id: companyId,
        p_from: from ?? null,
        p_to: to ?? null,
      })
      if (error) throw error
      return (data ?? []) as CrewConflictRow[]
    },
    enabled: !!companyId,
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
  return queryOptions<VehicleConflictRow[]>({
    queryKey: ['conflicts', 'vehicle', companyId, from ?? null, to ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conflicts_vehicle', {
        p_company_id: companyId,
        p_from: from ?? null,
        p_to: to ?? null,
      })
      if (error) throw error
      return (data ?? []) as VehicleConflictRow[]
    },
    enabled: !!companyId,
  })
}
