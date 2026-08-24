import { supabase } from '@shared/api/supabase'
import type { JobListRow } from '@features/jobs/types'

const LOGGED_JOB_SELECT = `
  id, company_id, title, jobnr, status, start_at, end_at, customer_contact_id, archived, recurring_job_id,
  customer:customer_id ( id, name ),
  customer_user:customer_user_id ( user_id, display_name, email ),
  project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url ),
  recurring_job:recurring_job_id ( id, title )
`

export function previouslyLoggedJobsQuery({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  return {
    queryKey: ['logging', 'previously-logged-jobs', companyId, userId],
    queryFn: async (): Promise<Array<JobListRow>> => {
      const { data: entries, error: entriesError } = await supabase
        .from('time_entries')
        .select('job_id, start_at')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .not('job_id', 'is', null)
        .order('start_at', { ascending: false })
        .limit(200)

      if (entriesError) throw entriesError

      const jobIds: Array<string> = []
      const seen = new Set<string>()
      for (const entry of entries ?? []) {
        if (!entry.job_id || seen.has(entry.job_id)) continue
        seen.add(entry.job_id)
        jobIds.push(entry.job_id)
      }
      if (jobIds.length === 0) return []

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select(LOGGED_JOB_SELECT)
        .in('id', jobIds)

      if (jobsError) throw jobsError

      const byId = new Map(
        ((jobs ?? []) as unknown as Array<JobListRow>).map((job) => [
          job.id,
          job,
        ]),
      )
      return jobIds.flatMap((id) => {
        const job = byId.get(id)
        return job ? [job] : []
      })
    },
    staleTime: 10_000,
  }
}
