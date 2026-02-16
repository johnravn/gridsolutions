import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

/**
 * Returns the set of job IDs where the current user is booked as crew
 * (reserved_crew with status planned or confirmed).
 * Used to show "You are crew" / "You are project lead + crew" badges in job lists.
 */
export function useJobCrewRoleIds({
  companyId,
  userId,
  jobIds,
}: {
  companyId: string | null
  userId: string | null
  jobIds: string[]
}) {
  const { data: crewJobIds = [] } = useQuery({
    queryKey: [
      'jobs',
      'crew-role-ids',
      companyId,
      userId,
      jobIds.length ? jobIds.slice(0, 50).join(',') : '',
    ],
    queryFn: async (): Promise<string[]> => {
      if (!userId || jobIds.length === 0) return []

      const { data: timePeriods, error: tpError } = await supabase
        .from('time_periods')
        .select('id, job_id')
        .in('job_id', jobIds)

      if (tpError) throw tpError
      const timePeriodIds = (timePeriods ?? []).map((tp) => tp.id)
      if (timePeriodIds.length === 0) return []

      const { data: crewRes, error: crewError } = await supabase
        .from('reserved_crew')
        .select('time_period_id')
        .eq('user_id', userId)
        .in('time_period_id', timePeriodIds)
        .in('status', ['planned', 'confirmed'])

      if (crewError) throw crewError

      const tpToJob = new Map<string, string>()
      ;(timePeriods ?? []).forEach((tp) => {
        if (tp.job_id) tpToJob.set(tp.id, tp.job_id)
      })

      const out: string[] = []
      ;(crewRes ?? []).forEach((c) => {
        const jobId = tpToJob.get(c.time_period_id)
        if (jobId) out.push(jobId)
      })
      return [...new Set(out)]
    },
    enabled: !!companyId && !!userId && jobIds.length > 0,
    staleTime: 30_000,
  })

  return React.useMemo(() => new Set(crewJobIds), [crewJobIds])
}
