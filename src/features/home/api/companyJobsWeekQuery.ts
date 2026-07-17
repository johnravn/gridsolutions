import { addWeeks, endOfWeek, startOfWeek } from 'date-fns'
import { supabase } from '@shared/api/supabase'
import type { CompanyRole } from '@shared/auth/permissions'
import type { JobListRow } from '@features/jobs/types'

function escapePostgrestOrValue(value: string) {
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function filterJobsVisibleToFreelancer(
  results: Array<JobListRow>,
  userId: string,
): Promise<Array<JobListRow>> {
  const jobIds = results.map((j) => j.id)
  if (jobIds.length === 0) return []

  const { data: timePeriods, error: tpError } = await supabase
    .from('time_periods')
    .select('id, job_id')
    .in('job_id', jobIds)
    .eq('category', 'crew')

  if (tpError) throw tpError
  if (timePeriods.length === 0) return []

  const timePeriodIds = timePeriods.map((tp) => tp.id)

  const { data: crewRes, error: crewError } = await supabase
    .from('reserved_crew')
    .select('time_period_id, status')
    .eq('user_id', userId)
    .in('time_period_id', timePeriodIds)

  if (crewError) throw crewError

  const tpJobById = new Map<string, string>()
  timePeriods.forEach((tp) => {
    if (tp.job_id) tpJobById.set(tp.id, tp.job_id)
  })

  const { data: inviteMatters, error: inviteError } = await supabase
    .from('matters')
    .select('time_period_id, matter_recipients!inner(user_id)')
    .eq('matter_type', 'crew_invite')
    .in('time_period_id', timePeriodIds)
    .eq('matter_recipients.user_id', userId)

  if (inviteError) throw inviteError

  const invitedTpIds = new Set<string>()
  ;(
    inviteMatters as unknown as Array<{ time_period_id: string | null }>
  ).forEach((m) => {
    if (m.time_period_id) invitedTpIds.add(m.time_period_id)
  })

  const visibleJobIds = new Set<string>()

  ;(
    crewRes as unknown as Array<{
      time_period_id: string
      status: 'planned' | 'confirmed' | 'canceled'
    }>
  ).forEach((c) => {
    const jobId = tpJobById.get(c.time_period_id)
    if (!jobId) return

    if (c.status === 'confirmed' || c.status === 'canceled') {
      visibleJobIds.add(jobId)
      return
    }

    if (invitedTpIds.has(c.time_period_id)) {
      visibleJobIds.add(jobId)
    }
  })

  invitedTpIds.forEach((tpId) => {
    const jobId = tpJobById.get(tpId)
    if (jobId) visibleJobIds.add(jobId)
  })

  return results.filter((job) => visibleJobIds.has(job.id))
}

export type CompanyJobsWeekOffset = 0 | 1 | 2

export function companyJobsWeekQuery({
  companyId,
  weekOffset,
  userId,
  companyRole,
}: {
  companyId: string
  weekOffset: CompanyJobsWeekOffset
  userId: string | null
  companyRole: CompanyRole | null
}) {
  return {
    queryKey: [
      'home',
      companyId,
      'company-jobs-week',
      weekOffset,
      userId,
      companyRole,
    ] as const,
    queryFn: async (): Promise<Array<JobListRow>> => {
      const base = addWeeks(new Date(), weekOffset)
      const weekStart = startOfWeek(base, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(base, { weekStartsOn: 1 })
      const weekStartIso = escapePostgrestOrValue(weekStart.toISOString())
      const weekEndIso = escapePostgrestOrValue(weekEnd.toISOString())

      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id, company_id, title, jobnr, status, start_at, end_at, customer_contact_id, archived,
          customer:customer_id ( id, name ),
          customer_user:customer_user_id ( user_id, display_name, email ),
          project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('company_id', companyId)
        .eq('archived', false)
        .neq('status', 'canceled')
        .lte('start_at', weekEndIso)
        .or(`end_at.is.null,end_at.gte.${weekStartIso}`)
        .order('start_at', { ascending: true })
        .limit(200)

      if (error) throw error

      let results = data as unknown as Array<JobListRow>

      if (companyRole === 'freelancer' && userId) {
        results = await filterJobsVisibleToFreelancer(results, userId)
      }

      return results
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  }
}
