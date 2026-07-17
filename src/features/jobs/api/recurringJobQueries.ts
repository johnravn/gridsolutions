import { supabase } from '@shared/api/supabase'
import { fuzzySearch } from '@shared/lib/generalFunctions'
import { aggregateRecurringJobCrew } from '../utils/aggregateRecurringJobCrew'
import { copyJob, deleteJobById } from './queries'
import type { RawCrewBooking } from '../utils/aggregateRecurringJobCrew'
import type {
  JobListRow,
  JobStatus,
  RecurringJobBookingSummary,
  RecurringJobCrewEntry,
  RecurringJobDetail,
  RecurringJobInvoiceEntry,
  RecurringJobListRow,
  RecurringJobTemplate,
  UUID,
} from '../types'

const RECURRING_JOB_SELECT = `
  id, company_id, title, description, archived, period_start, period_end,
  project_lead_user_id, customer_id, customer_user_id, customer_contact_id,
  customer:customer_id ( id, name ),
  customer_user:customer_user_id ( user_id, display_name, email ),
  customer_contact:customer_contact_id ( id, name, email, phone ),
  project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url )
`

const MEMBER_JOB_SELECT = `
  id, company_id, title, jobnr, status, start_at, end_at, customer_contact_id, archived, recurring_job_id,
  customer:customer_id ( id, name ),
  customer_user:customer_user_id ( user_id, display_name, email ),
  project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url )
`

async function attachJobCounts(
  rows: Array<Omit<RecurringJobListRow, 'job_count'>>,
): Promise<Array<RecurringJobListRow>> {
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const { data: counts, error } = await supabase
    .from('jobs')
    .select('recurring_job_id')
    .in('recurring_job_id', ids)

  if (error) throw error

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    if (!row.recurring_job_id) continue
    countMap.set(
      row.recurring_job_id,
      (countMap.get(row.recurring_job_id) ?? 0) + 1,
    )
  }

  return rows.map((r) => ({
    ...r,
    job_count: countMap.get(r.id) ?? 0,
  }))
}

export function recurringJobsIndexQuery({
  companyId,
  search = '',
  projectLeadUserId,
  includeArchived = false,
}: {
  companyId: string
  search?: string
  projectLeadUserId?: string | null
  includeArchived?: boolean
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'recurring-jobs-index',
      search,
      projectLeadUserId,
      includeArchived,
    ],
    queryFn: async (): Promise<Array<RecurringJobListRow>> => {
      let q = supabase
        .from('recurring_jobs')
        .select(RECURRING_JOB_SELECT)
        .eq('company_id', companyId)
        .order('title', { ascending: true })

      if (!includeArchived) {
        q = q.eq('archived', false)
      }

      if (projectLeadUserId) {
        q = q.eq('project_lead_user_id', projectLeadUserId)
      }

      const { data, error } = await q
      if (error) throw error

      let results = await attachJobCounts(
        (data ?? []) as unknown as Array<
          Omit<RecurringJobListRow, 'job_count'>
        >,
      )

      if (search.trim()) {
        results = fuzzySearch(
          results,
          search,
          [
            (r) => r.title,
            (r) => r.description,
            (r) => r.customer?.name ?? null,
            (r) => r.customer_user?.display_name ?? null,
            (r) => r.customer_user?.email ?? null,
            (r) => r.project_lead?.display_name ?? null,
            (r) => r.project_lead?.email ?? null,
            (r) => String(r.job_count),
          ],
          0.25,
        )
      }

      return results
    },
  }
}

export function recurringJobDetailQuery({
  recurringJobId,
}: {
  recurringJobId: string
}) {
  return {
    queryKey: ['recurring-jobs-detail', recurringJobId],
    queryFn: async (): Promise<RecurringJobDetail | null> => {
      const { data, error } = await supabase
        .from('recurring_jobs')
        .select(RECURRING_JOB_SELECT)
        .eq('id', recurringJobId)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select(MEMBER_JOB_SELECT)
        .eq('recurring_job_id', recurringJobId)
        .order('start_at', { ascending: true })

      if (jobsError) throw jobsError

      const base = data as unknown as Omit<
        RecurringJobDetail,
        'jobs' | 'job_count'
      >
      const memberJobs = (jobs ?? []) as unknown as Array<JobListRow>

      return {
        ...base,
        job_count: memberJobs.length,
        jobs: memberJobs,
      }
    },
  }
}

export function recurringJobCrewSummaryQuery({
  recurringJobId,
}: {
  recurringJobId: string
}) {
  return {
    queryKey: ['recurring-jobs-crew', recurringJobId],
    queryFn: async (): Promise<Array<RecurringJobCrewEntry>> => {
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, jobnr')
        .eq('recurring_job_id', recurringJobId)

      if (jobsError) throw jobsError
      if (!jobs?.length) return []

      const jobIds = jobs.map((j) => j.id)
      const jobMap = new Map(jobs.map((j) => [j.id, j]))

      const { data: timePeriods, error: tpError } = await supabase
        .from('time_periods')
        .select('id, job_id, title, start_at, end_at')
        .in('job_id', jobIds)
        .eq('category', 'crew')

      if (tpError) throw tpError
      if (!timePeriods?.length) return []

      const tpIds = timePeriods.map((tp) => tp.id)
      const tpMap = new Map(timePeriods.map((tp) => [tp.id, tp]))

      const { data: crewRows, error: crewError } = await supabase
        .from('reserved_crew')
        .select(
          `
          time_period_id, status,
          user:user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .in('time_period_id', tpIds)

      if (crewError) throw crewError

      const raw: Array<RawCrewBooking> = []
      for (const row of crewRows ?? []) {
        const tp = tpMap.get(row.time_period_id)
        if (!tp?.job_id) continue
        const job = jobMap.get(tp.job_id)
        if (!job) continue
        const user = Array.isArray(row.user) ? row.user[0] : row.user
        if (!user?.user_id) continue

        raw.push({
          user_id: user.user_id,
          display_name: user.display_name,
          email: user.email,
          avatar_url: user.avatar_url,
          job_id: job.id,
          job_title: job.title,
          jobnr: job.jobnr,
          role_title: tp.title,
          start_at: tp.start_at,
          end_at: tp.end_at,
          status: row.status,
        })
      }

      return aggregateRecurringJobCrew(raw)
    },
  }
}

export function recurringJobInvoiceSummaryQuery({
  recurringJobId,
}: {
  recurringJobId: string
}) {
  return {
    queryKey: ['recurring-jobs-invoices', recurringJobId],
    queryFn: async (): Promise<Array<RecurringJobInvoiceEntry>> => {
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, jobnr, status')
        .eq('recurring_job_id', recurringJobId)
        .order('start_at', { ascending: true })

      if (jobsError) throw jobsError
      if (!jobs?.length) return []

      const jobIds = jobs.map((j) => j.id)

      const { data: invoices, error: invError } = await supabase
        .from('job_invoices')
        .select('job_id, created_at')
        .in('job_id', jobIds)

      if (invError) throw invError

      const invoiceMap = new Map<
        string,
        { count: number; last_at: string | null }
      >()
      for (const inv of invoices ?? []) {
        const existing = invoiceMap.get(inv.job_id) ?? {
          count: 0,
          last_at: null,
        }
        existing.count += 1
        if (!existing.last_at || inv.created_at > existing.last_at) {
          existing.last_at = inv.created_at
        }
        invoiceMap.set(inv.job_id, existing)
      }

      return jobs.map((job) => {
        const inv = invoiceMap.get(job.id)
        return {
          job_id: job.id,
          job_title: job.title,
          jobnr: job.jobnr,
          status: job.status,
          invoice_count: inv?.count ?? 0,
          last_invoice_at: inv?.last_at ?? null,
        }
      })
    },
  }
}

export function recurringJobBookingSummaryQuery({
  recurringJobId,
}: {
  recurringJobId: string
}) {
  return {
    queryKey: ['recurring-jobs-bookings', recurringJobId],
    queryFn: async (): Promise<Array<RecurringJobBookingSummary>> => {
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, jobnr')
        .eq('recurring_job_id', recurringJobId)
        .order('start_at', { ascending: true })

      if (jobsError) throw jobsError
      if (!jobs?.length) return []

      const jobIds = jobs.map((j) => j.id)

      const { data: timePeriods, error: tpError } = await supabase
        .from('time_periods')
        .select('id, job_id, category')
        .in('job_id', jobIds)

      if (tpError) throw tpError

      const tpByJob = new Map<
        string,
        {
          equipment: Array<string>
          crew: Array<string>
          transport: Array<string>
        }
      >()
      for (const tp of timePeriods ?? []) {
        if (!tp.job_id) continue
        const bag = tpByJob.get(tp.job_id) ?? {
          equipment: [],
          crew: [],
          transport: [],
        }
        if (tp.category === 'equipment') bag.equipment.push(tp.id)
        else if (tp.category === 'crew') bag.crew.push(tp.id)
        else if (tp.category === 'transport') bag.transport.push(tp.id)
        tpByJob.set(tp.job_id, bag)
      }

      const allTpIds = (timePeriods ?? [])
        .map((tp) => tp.id)
        .filter((id): id is string => !!id)
      const equipmentCounts = new Map<string, number>()
      const crewCounts = new Map<string, number>()
      const transportCounts = new Map<string, number>()

      if (allTpIds.length > 0) {
        const [eqRes, crewRes, transportRes] = await Promise.all([
          supabase
            .from('reserved_items')
            .select('time_period_id')
            .in('time_period_id', allTpIds),
          supabase
            .from('reserved_crew')
            .select('time_period_id')
            .in('time_period_id', allTpIds),
          supabase
            .from('reserved_vehicles')
            .select('time_period_id')
            .in('time_period_id', allTpIds),
        ])

        if (eqRes.error) throw eqRes.error
        if (crewRes.error) throw crewRes.error
        if (transportRes.error) throw transportRes.error

        const tpToJob = new Map(
          (timePeriods ?? [])
            .filter((tp): tp is typeof tp & { id: string; job_id: string } =>
              Boolean(tp.id && tp.job_id),
            )
            .map((tp) => [tp.id, tp.job_id]),
        )

        for (const row of eqRes.data ?? []) {
          const jobId = tpToJob.get(row.time_period_id)
          if (jobId)
            equipmentCounts.set(jobId, (equipmentCounts.get(jobId) ?? 0) + 1)
        }
        for (const row of crewRes.data ?? []) {
          const jobId = tpToJob.get(row.time_period_id)
          if (jobId) crewCounts.set(jobId, (crewCounts.get(jobId) ?? 0) + 1)
        }
        for (const row of transportRes.data ?? []) {
          const jobId = tpToJob.get(row.time_period_id)
          if (jobId)
            transportCounts.set(jobId, (transportCounts.get(jobId) ?? 0) + 1)
        }
      }

      return jobs.map((job) => ({
        job_id: job.id,
        job_title: job.title,
        jobnr: job.jobnr,
        equipment_count: equipmentCounts.get(job.id) ?? 0,
        crew_count: crewCounts.get(job.id) ?? 0,
        transport_count: transportCounts.get(job.id) ?? 0,
      }))
    },
  }
}

export async function createRecurringJob(payload: {
  companyId: UUID
  title: string
  description?: string | null
  projectLeadUserId?: UUID | null
  customerId?: UUID | null
  customerUserId?: UUID | null
  customerContactId?: UUID | null
  periodStart: string
  periodEnd?: string | null
}): Promise<UUID> {
  const { data, error } = await supabase
    .from('recurring_jobs')
    .insert({
      company_id: payload.companyId,
      title: payload.title.trim(),
      description: payload.description ?? null,
      project_lead_user_id: payload.projectLeadUserId ?? null,
      customer_id: payload.customerId ?? null,
      customer_user_id: payload.customerUserId ?? null,
      customer_contact_id: payload.customerContactId ?? null,
      period_start: payload.periodStart,
      period_end: payload.periodEnd ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function updateRecurringJob(payload: {
  id: UUID
  title: string
  description?: string | null
  projectLeadUserId?: UUID | null
  customerId?: UUID | null
  customerUserId?: UUID | null
  customerContactId?: UUID | null
  periodStart: string
  periodEnd?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('recurring_jobs')
    .update({
      title: payload.title.trim(),
      description: payload.description ?? null,
      project_lead_user_id: payload.projectLeadUserId ?? null,
      customer_id: payload.customerId ?? null,
      customer_user_id: payload.customerUserId ?? null,
      customer_contact_id: payload.customerContactId ?? null,
      period_start: payload.periodStart,
      period_end: payload.periodEnd ?? null,
    })
    .eq('id', payload.id)

  if (error) throw error
}

export async function archiveRecurringJob(id: UUID): Promise<void> {
  const { error } = await supabase
    .from('recurring_jobs')
    .update({ archived: true })
    .eq('id', id)

  if (error) throw error
}

export type DeleteRecurringJobMode = 'detach' | 'delete_all_jobs'

export async function deleteRecurringJob(payload: {
  id: UUID
  mode: DeleteRecurringJobMode
}): Promise<void> {
  if (payload.mode === 'delete_all_jobs') {
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id')
      .eq('recurring_job_id', payload.id)

    if (jobsError) throw jobsError

    for (const job of jobs ?? []) {
      await deleteJobById(job.id)
    }
  }

  const { error } = await supabase
    .from('recurring_jobs')
    .delete()
    .eq('id', payload.id)

  if (error) throw error
}

export async function assignJobToRecurringJob(payload: {
  jobId: UUID
  recurringJobId: UUID
}): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ recurring_job_id: payload.recurringJobId })
    .eq('id', payload.jobId)

  if (error) throw error
}

export async function removeJobFromRecurringJob(jobId: UUID): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ recurring_job_id: null })
    .eq('id', jobId)

  if (error) throw error
}

export function unassignedJobsQuery({
  companyId,
  search = '',
}: {
  companyId: string
  search?: string
}) {
  return {
    queryKey: ['company', companyId, 'unassigned-jobs', search],
    queryFn: async (): Promise<Array<JobListRow>> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(MEMBER_JOB_SELECT)
        .eq('company_id', companyId)
        .eq('archived', false)
        .is('recurring_job_id', null)
        .order('start_at', { ascending: false })
        .limit(200)

      if (error) throw error

      let results = (data ?? []) as unknown as Array<JobListRow>

      if (search.trim()) {
        results = fuzzySearch(
          results,
          search,
          [
            (j) => j.title,
            (j) => (j.jobnr != null ? String(j.jobnr) : null),
            (j) => j.customer?.name ?? null,
          ],
          0.25,
        )
      }

      return results
    },
  }
}

export function recurringJobTemplatesQuery({
  recurringJobId,
}: {
  recurringJobId: string
}) {
  return {
    queryKey: ['recurring-jobs-templates', recurringJobId],
    queryFn: async (): Promise<Array<RecurringJobTemplate>> => {
      const { data, error } = await supabase
        .from('recurring_job_templates')
        .select(
          'id, recurring_job_id, company_id, name, title, description, status, duration_hours, start_time, crew_roles, sort_order',
        )
        .eq('recurring_job_id', recurringJobId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []).map((row) => ({
        ...row,
        duration_hours: Number(row.duration_hours),
        start_time: row.start_time ?? null,
        crew_roles: Array.isArray(row.crew_roles)
          ? (row.crew_roles as Array<
              RecurringJobTemplate['crew_roles'][number]
            >)
          : [],
      })) as Array<RecurringJobTemplate>
    },
  }
}

export async function createRecurringJobTemplate(payload: {
  recurringJobId: UUID
  companyId: UUID
  name: string
  title: string
  description?: string | null
  status?: JobStatus
  durationHours?: number
  startTime?: string | null
  crewRoles?: RecurringJobTemplate['crew_roles']
}): Promise<UUID> {
  const { data, error } = await supabase
    .from('recurring_job_templates')
    .insert({
      recurring_job_id: payload.recurringJobId,
      company_id: payload.companyId,
      name: payload.name.trim(),
      title: payload.title.trim(),
      description: payload.description ?? null,
      status: payload.status ?? 'planned',
      duration_hours: payload.durationHours ?? 3,
      start_time: payload.startTime ?? null,
      crew_roles: payload.crewRoles ?? [],
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function updateRecurringJobTemplate(payload: {
  id: UUID
  name: string
  title: string
  description?: string | null
  status?: JobStatus
  durationHours?: number
  startTime?: string | null
  crewRoles?: RecurringJobTemplate['crew_roles']
}): Promise<void> {
  const { error } = await supabase
    .from('recurring_job_templates')
    .update({
      name: payload.name.trim(),
      title: payload.title.trim(),
      description: payload.description ?? null,
      status: payload.status ?? 'planned',
      duration_hours: payload.durationHours ?? 3,
      start_time: payload.startTime ?? null,
      crew_roles: payload.crewRoles ?? [],
    })
    .eq('id', payload.id)

  if (error) throw error
}

export async function deleteRecurringJobTemplate(id: UUID): Promise<void> {
  const { error } = await supabase
    .from('recurring_job_templates')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function copyJobIntoRecurringJob(payload: {
  jobId: UUID
  startAt: string
  endAt: string
  recurringJobId: UUID
}): Promise<UUID> {
  const newJobId = await copyJob({
    jobId: payload.jobId,
    startAt: payload.startAt,
    endAt: payload.endAt,
  })
  await assignJobToRecurringJob({
    jobId: newJobId,
    recurringJobId: payload.recurringJobId,
  })
  return newJobId
}

export async function deleteRecurringMemberJob(jobId: UUID): Promise<void> {
  await deleteJobById(jobId)
}
