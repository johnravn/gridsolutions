import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, startOfMinute } from 'date-fns'
import { supabase } from '@shared/api/supabase'
import { jobsIndexQuery } from '@features/jobs/api/queries'
import { resolveMyJobRole } from '../utils/resolveMyJobRole'
import type { CompanyRole } from '@shared/auth/permissions'
import type { UpcomingJob } from '../types'

export function useUpcomingJobs({
  companyId,
  userId,
  companyRole,
  daysFilter,
  showMyJobsOnly,
}: {
  companyId: string | null
  userId: string | null
  companyRole: CompanyRole | null
  daysFilter: '7' | '14' | '30' | 'all'
  showMyJobsOnly: boolean
}) {
  const isFreelancer = companyRole === 'freelancer'

  // Stable timestamps so queryKey doesn't change every render (see HomePage conflict range).
  const { upcomingFrom, now, dateRangeEnd } = React.useMemo(() => {
    const current = startOfMinute(new Date())
    return {
      upcomingFrom: current.toISOString(),
      now: current,
      dateRangeEnd:
        daysFilter === 'all'
          ? null
          : addDays(current, parseInt(daysFilter, 10)),
    }
  }, [daysFilter])

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '',
      search: '',
      sortBy: 'start_at',
      sortDir: 'asc',
      userId: userId ?? null,
      companyRole: companyRole ?? null,
      maxRows: 30,
      upcomingFrom,
    }),
    enabled: !!companyId,
  })

  const upcomingJobs = React.useMemo(() => {
    if (!jobsData) return []
    return jobsData.filter((job) => {
      // Canceled jobs should never be treated as upcoming (and should not show "You are crew")
      if (job.status === 'canceled') return false
      if (job.status === 'in_progress') return true
      if (!job.start_at) return false
      const startDate = new Date(job.start_at)
      if (dateRangeEnd === null) return startDate >= now
      return startDate >= now && startDate <= dateRangeEnd
    })
  }, [jobsData, now, dateRangeEnd])

  const jobIdsForCrewLookup = React.useMemo(
    () => upcomingJobs.map((j) => j.id),
    [upcomingJobs],
  )

  const { data: crewJobIds = [], isLoading: crewJobIdsLoading } = useQuery({
    queryKey: [
      'home',
      'upcoming-jobs',
      'crew-job-ids',
      companyId,
      userId,
      jobIdsForCrewLookup,
    ],
    queryFn: async (): Promise<Array<string>> => {
      if (!userId) return []
      if (jobIdsForCrewLookup.length === 0) return []

      const { data: timePeriods, error: tpError } = await supabase
        .from('time_periods')
        .select('id, job_id')
        .in('job_id', jobIdsForCrewLookup)

      if (tpError) throw tpError

      const timePeriodIds = timePeriods.map((tp) => tp.id)
      if (timePeriodIds.length === 0) return []

      const { data: crewRes, error: crewError } = await supabase
        .from('reserved_crew')
        .select('time_period_id, status')
        .eq('user_id', userId)
        .in('time_period_id', timePeriodIds)
        .in('status', ['planned', 'confirmed'])

      if (crewError) throw crewError

      const tpJobById = new Map<string, string>()
      timePeriods.forEach((tp) => {
        if (tp.job_id) tpJobById.set(tp.id, tp.job_id)
      })

      const crewJobIdSet = new Set<string>()
      crewRes.forEach((c) => {
        const jobId = tpJobById.get(c.time_period_id)
        if (jobId) crewJobIdSet.add(jobId)
      })

      return Array.from(crewJobIdSet)
    },
    enabled:
      !!companyId &&
      !!userId &&
      jobIdsForCrewLookup.length > 0 &&
      !isFreelancer,
    staleTime: 10_000,
  })

  const crewJobIdSet = React.useMemo(
    () => new Set<string>(crewJobIds),
    [crewJobIds],
  )

  const upcomingJobsWithMyRole = React.useMemo((): Array<UpcomingJob> => {
    return upcomingJobs.map((job) => {
      const isCrew = isFreelancer || crewJobIdSet.has(job.id)
      const my_job_role = resolveMyJobRole({
        userId,
        projectLeadUserId: job.project_lead?.user_id,
        isCrew,
      })
      return { ...job, my_job_role }
    })
  }, [upcomingJobs, crewJobIdSet, userId, isFreelancer])

  const filteredUpcomingJobs = React.useMemo(() => {
    if (isFreelancer) return upcomingJobsWithMyRole
    if (!showMyJobsOnly || !userId) return upcomingJobsWithMyRole
    return upcomingJobsWithMyRole.filter((job) => job.my_job_role !== null)
  }, [upcomingJobsWithMyRole, showMyJobsOnly, userId, isFreelancer])

  const loading =
    jobsLoading || (!isFreelancer && showMyJobsOnly && crewJobIdsLoading)

  return {
    jobs: filteredUpcomingJobs,
    loading,
    isFreelancer,
  }
}
