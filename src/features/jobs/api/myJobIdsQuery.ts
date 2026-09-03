import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export function unionJobIds(
  ...lists: Array<Array<string | null | undefined>>
): Array<string> {
  const ids = new Set<string>()
  for (const list of lists) {
    for (const id of list) {
      if (id) ids.add(id)
    }
  }
  return Array.from(ids).sort()
}

export async function fetchMyJobIds({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}): Promise<Array<string>> {
  const { data: leadJobs, error: leadError } = await supabase
    .from('jobs')
    .select('id')
    .eq('company_id', companyId)
    .eq('project_lead_user_id', userId)

  if (leadError) throw leadError

  const { data: crewRows, error: crewError } = await supabase
    .from('reserved_crew')
    .select('time_period_id')
    .eq('user_id', userId)
    .in('status', ['planned', 'confirmed'])

  if (crewError) throw crewError

  const timePeriodIds = [
    ...new Set((crewRows ?? []).map((row) => row.time_period_id)),
  ]
  if (timePeriodIds.length === 0) {
    return unionJobIds((leadJobs ?? []).map((row) => row.id))
  }

  const { data: periods, error: periodsError } = await supabase
    .from('time_periods')
    .select('job_id')
    .in('id', timePeriodIds)

  if (periodsError) throw periodsError

  const crewCandidateIds = [
    ...new Set(
      (periods ?? [])
        .map((period) => period.job_id)
        .filter((id): id is string => !!id),
    ),
  ]
  if (crewCandidateIds.length === 0) {
    return unionJobIds((leadJobs ?? []).map((row) => row.id))
  }

  const { data: crewJobs, error: crewJobsError } = await supabase
    .from('jobs')
    .select('id')
    .eq('company_id', companyId)
    .in('id', crewCandidateIds)

  if (crewJobsError) throw crewJobsError

  return unionJobIds(
    (leadJobs ?? []).map((row) => row.id),
    (crewJobs ?? []).map((row) => row.id),
  )
}

export function myJobIdsQuery({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  return queryOptions<Array<string>>({
    queryKey: ['company', companyId, 'my-job-ids', userId] as const,
    queryFn: () => fetchMyJobIds({ companyId, userId }),
    staleTime: 30_000,
  })
}
