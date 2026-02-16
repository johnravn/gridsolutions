import { supabase } from '@shared/api/supabase'
import type {
  AddressListRow,
  JobDetail,
  JobListRow,
  TimePeriodLite,
} from '../types'

function escapeForPostgrestOr(value: string) {
  // PostgREST uses commas and parentheses to separate conditions.
  // Strip or space them out so user input can't break the expression.
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function jobsIndexQuery({
  companyId,
  search,
  selectedDate,
  sortBy = 'start_at',
  sortDir = 'desc',
  userId,
  companyRole,
  includeArchived = false,
  showOnlyArchived = false,
  onlyCrewForUserId = null,
}: {
  companyId: string
  search: string
  selectedDate?: string
  sortBy?: 'title' | 'start_at' | 'status' | 'customer_name'
  sortDir?: 'asc' | 'desc'
  userId?: string | null
  companyRole?: 'owner' | 'employee' | 'freelancer' | 'super_user' | null
  includeArchived?: boolean
  showOnlyArchived?: boolean
  onlyCrewForUserId?: string | null
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'jobs-index',
      search,
      selectedDate,
      sortBy,
      sortDir,
      userId,
      companyRole,
      includeArchived,
      showOnlyArchived,
      onlyCrewForUserId,
    ],
    queryFn: async (): Promise<Array<JobListRow>> => {
      let q = supabase
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

      // Visibility: show only archived, or only non-archived
      if (showOnlyArchived) {
        q = q.eq('archived', true)
      } else {
        // When showOnlyArchived not set, respect includeArchived for backward compatibility (e.g. JobsTable, LoggingPage)
        if (!includeArchived) {
          q = q.eq('archived', false)
        }
      }

      // Note: We don't filter server-side when searching because we need to search
      // customer name (joined relation) which PostgREST doesn't support.
      // All filtering is done client-side to support title, customer, and date search.

      // Sorting
      if (sortBy === 'customer_name') {
        // For customer name, we need to sort by the joined relation
        // PostgREST doesn't support sorting by joined columns directly,
        // so we'll sort client-side or use a different approach
        q = q.order('start_at', { ascending: sortDir === 'asc' })
      } else {
        q = q.order(sortBy, { ascending: sortDir === 'asc' })
      }

      const { data, error } = await q
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      let results = (data || []) as unknown as Array<JobListRow>

      // Filter by selected date (jobs in progress on that date)
      if (selectedDate) {
        const selected = new Date(selectedDate)
        selected.setHours(0, 0, 0, 0)
        const selectedDateStr = selected.toISOString().split('T')[0]

        results = results.filter((job) => {
          if (!job.start_at) return false

          const startDate = new Date(job.start_at)
          startDate.setHours(0, 0, 0, 0)
          const startDateStr = startDate.toISOString().split('T')[0]

          // If no end_at, check if selected date >= start date
          const jobEndAt = job.end_at
          if (!jobEndAt) {
            return selectedDateStr >= startDateStr
          }

          const endDate = new Date(jobEndAt)
          endDate.setHours(0, 0, 0, 0)
          const endDateStr = endDate.toISOString().split('T')[0]

          // Job is in progress if selected date is between start and end (inclusive)
          return (
            selectedDateStr >= startDateStr && selectedDateStr <= endDateStr
          )
        })
      }

      // Client-side fuzzy filtering across title, customer name, customer user name, project lead name, status, and date
      // (PostgREST doesn't support filtering on joined columns like customer.name)
      if (search.trim()) {
        const { fuzzySearch, makeWordPresentable } = await import(
          '@shared/lib/generalFunctions'
        )
        results = fuzzySearch(
          results,
          search,
          [
            (job) => job.title,
            (job) => (job.jobnr != null ? String(job.jobnr) : null),
            (job) => job.customer?.name ?? null,
            (job) => job.customer_user?.display_name ?? null,
            (job) => job.customer_user?.email ?? null,
            (job) => job.project_lead?.display_name ?? null,
            (job) => job.project_lead?.email ?? null,
            (job) => job.start_at ?? null,
            // Search status by both raw value and presentable format (e.g., "in progress" matches "in_progress")
            (job) => job.status,
            (job) => makeWordPresentable(job.status),
          ],
          0.25, // Lower threshold for fuzzy matching
        )
      }

      // Client-side sort for customer_name
      if (sortBy === 'customer_name') {
        results = [...results].sort((a, b) => {
          const aName =
            a.customer?.name ??
            a.customer_user?.display_name ??
            a.customer_user?.email ??
            ''
          const bName =
            b.customer?.name ??
            b.customer_user?.display_name ??
            b.customer_user?.email ??
            ''
          const comparison = aName.localeCompare(bName)
          return sortDir === 'asc' ? comparison : -comparison
        })
      }

      // Filter for freelancers to only show jobs they're part of (active crew bookings)
      if (companyRole === 'freelancer' && userId) {
        // Freelancers should see jobs they are:
        // - invited to (crew_invite matter)
        // - accepted (reserved_crew.status = confirmed)
        // - canceled (reserved_crew.status = canceled)
        //
        // "Invited" is modeled as a crew_invite matter on a crew time_period,
        // and typically corresponds to reserved_crew.status = planned.
        const jobIds = results.map((j) => j.id)
        if (jobIds.length === 0) return []

        // 1) Get crew time periods for these jobs (reserved_crew links to time_periods)
        const { data: timePeriods, error: tpError } = await supabase
          .from('time_periods')
          .select('id, job_id')
          .in('job_id', jobIds)
          .eq('category', 'crew')

        if (tpError) throw tpError
        if (timePeriods.length === 0) return []

        const timePeriodIds = timePeriods.map((tp) => tp.id)

        // 2) Get this user's crew reservations across those time periods
        const { data: crewRes, error: crewError } = await supabase
          .from('reserved_crew')
          .select('time_period_id, status')
          .eq('user_id', userId)
          .in('time_period_id', timePeriodIds)

        if (crewError) throw crewError

        // Map time_period_id -> job_id
        const tpJobById = new Map<string, string>()
        timePeriods.forEach((tp) => {
          if (tp.job_id) tpJobById.set(tp.id, tp.job_id)
        })

        // 3) Fetch crew_invite matters where this user is a recipient for these tps
        const { data: inviteMatters, error: inviteError } = await supabase
          .from('matters' as any)
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

        // - accepted/canceled jobs (based on reserved_crew status)
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

          // - invited jobs: planned + has crew_invite matter for that tp
          if (invitedTpIds.has(c.time_period_id)) {
            visibleJobIds.add(jobId)
          }
        })

        // Also include any invite matters that might exist without a reserved_crew row yet
        invitedTpIds.forEach((tpId) => {
          const jobId = tpJobById.get(tpId)
          if (jobId) visibleJobIds.add(jobId)
        })

        results = results.filter((job) => visibleJobIds.has(job.id))
      }

      // Filter to jobs where onlyCrewForUserId is on crew (any status) for crew time periods
      if (onlyCrewForUserId && results.length > 0) {
        const jobIds = results.map((j) => j.id)
        const { data: timePeriods, error: tpError } = await supabase
          .from('time_periods')
          .select('id, job_id')
          .eq('category', 'crew')
          .in('job_id', jobIds)

        if (tpError) throw tpError

        if (timePeriods && timePeriods.length > 0) {
          const timePeriodIds = timePeriods.map((tp: { id: string }) => tp.id)
          const { data: crewRes, error: crewError } = await supabase
            .from('reserved_crew')
            .select('time_period_id')
            .eq('user_id', onlyCrewForUserId)
            .in('time_period_id', timePeriodIds)

          if (crewError) throw crewError

          const jobIdsWithUserAsCrew = new Set<string>()
          if (crewRes && timePeriods) {
            crewRes.forEach((c: { time_period_id: string }) => {
              const tp = timePeriods.find(
                (t: { id: string; job_id: string | null }) =>
                  t.id === c.time_period_id,
              )
              if (tp?.job_id) jobIdsWithUserAsCrew.add(tp.job_id)
            })
          }
          results = results.filter((job) => jobIdsWithUserAsCrew.has(job.id))
        } else {
          results = []
        }
      }

      return results
    },
    staleTime: 10_000,
  }
}

// Simple query to get customers for dropdown filter
export function customersForFilterQuery(companyId: string) {
  return {
    queryKey: ['company', companyId, 'customers-for-filter'] as const,
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .or('deleted.is.null,deleted.eq.false')
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<{ id: string; name: string }>
    },
    staleTime: 60_000,
  }
}

export function addressIndexQuery({
  companyId,
  search,
}: {
  companyId: string
  search: string
}) {
  return {
    queryKey: ['address', companyId, 'address-index', search],
    queryFn: async (): Promise<Array<AddressListRow>> => {
      let q = supabase
        .from('addresses')
        .select(
          `
            id, company_id, name, address_line, zip_code, city, country,
            created_at, updated_at, deleted, is_personal
          `,
        )
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(100)

      q = q.or('deleted.is.null,deleted.eq.false')

      if (search.trim()) {
        // 1) Escape LIKE wildcards that users may type
        const likeSafe = escapePgLike(search.trim())
        // 2) Escape PostgREST .or() separators and parens in the *filter string*
        const orSafe = escapeForPostgrestOr(likeSafe)

        // 3) Use % (Postgres wildcard), not *
        const orFilter = [
          `name.ilike.%${orSafe}%`,
          `address_line.ilike.%${orSafe}%`,
          `zip_code.ilike.%${orSafe}%`,
          `city.ilike.%${orSafe}%`,
          `country.ilike.%${orSafe}%`,
        ].join(',')

        q = q.or(orFilter)
      }

      const { data, error } = await q
      if (error) throw error
      return data as unknown as Array<AddressListRow>
    },
    staleTime: 10_000,
  }
}

/** Escape % and _ which are wildcards in LIKE/ILIKE */
function escapePgLike(input: string) {
  return input.replace(/[%_]/g, (m) => '\\' + m)
}

export function jobDetailQuery({ jobId }: { jobId: string }) {
  return {
    queryKey: ['jobs-detail', jobId],
    queryFn: async (): Promise<JobDetail | null> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id, company_id, title, jobnr, description, status, start_at, end_at, archived, invoice_basis,
          project_lead_user_id, customer_id, customer_user_id, customer_contact_id, job_address_id,
          customer:customer_id ( id, name, email, phone, address, vat_number ),
          customer_user:customer_user_id ( user_id, display_name, email, phone ),
          project_lead:project_lead_user_id ( user_id, display_name, email ),
          customer_contact:customer_contact_id ( id, name, email, phone, title ),
          address:job_address_id ( id, name, address_line, zip_code, city, country )
        `,
        )
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw error
      return data as JobDetail | null
    },
  }
}

// Time Periods for a job
export function jobTimePeriodsQuery({ jobId }: { jobId: string }) {
  return {
    queryKey: ['jobs', jobId, 'time_periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_periods')
        .select('id, company_id, job_id, title, start_at, end_at, category')
        .eq('job_id', jobId)
        .order('start_at', { ascending: true })
      if (error) throw error
      return data as Array<TimePeriodLite>
    },
  }
}

// Create/update time period
export async function upsertTimePeriod(payload: {
  id?: string
  job_id: string
  company_id: string
  title: string
  start_at: string // ISO
  end_at: string // ISO
  category?: 'program' | 'equipment' | 'crew' | 'transport'
}) {
  if (payload.id) {
    const { error } = await supabase
      .from('time_periods')
      .update({
        title: payload.title,
        start_at: payload.start_at,
        end_at: payload.end_at,
        // Don't update category on edit (preserve existing)
      })
      .eq('id', payload.id)
    if (error) throw error
    return payload.id
  } else {
    const { data, error } = await supabase
      .from('time_periods')
      .insert({
        job_id: payload.job_id,
        company_id: payload.company_id,
        title: payload.title,
        start_at: payload.start_at,
        end_at: payload.end_at,
        category: payload.category ?? 'program',
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
}
