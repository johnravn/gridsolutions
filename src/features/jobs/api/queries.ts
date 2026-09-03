import { supabase } from '@shared/api/supabase'
import { parseCopyJobRpcResult } from '../utils/copyJobConflicts'
import {
  jobsIndexDateOverlapFilters,
  resolveJobsIndexDateOverlap,
} from './jobsIndexDateOverlap'
import type { CopyJobResult } from '../utils/copyJobConflicts'
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

const JOBS_LIST_SELECT = `
  id, company_id, title, jobnr, status, start_at, end_at, customer_contact_id, archived, recurring_job_id,
  customer:customer_id ( id, name ),
  customer_user:customer_user_id ( user_id, display_name, email ),
  project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url ),
  recurring_job:recurring_job_id ( id, title )
`

type JobsIndexSortBy = 'title' | 'start_at' | 'status' | 'customer_name'
type JobsIndexSortDir = 'asc' | 'desc'

export const JOBS_INDEX_INFINITE_PAGE_SIZE = 50

export type JobsIndexPageResult = {
  rows: Array<JobListRow>
  count: number
  /** Rows returned by PostgREST before freelancer visibility filtering. */
  fetched: number
  page: number
}

/**
 * Freelancers should see jobs they are invited to, accepted on, or canceled from.
 * Applied after paging so RLS-visible rows can still be narrowed per page.
 */
async function restrictJobsIndexToFreelancer(
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

export function jobsIndexQuery({
  companyId,
  search,
  dateFrom,
  dateTo,
  sortBy = 'start_at',
  sortDir = 'desc',
  userId,
  companyRole,
  includeArchived = false,
  showOnlyArchived = false,
  onlyCrewForUserId = null,
  /** When set, only jobs where this user is project lead (mirrors homepage ready-to-invoice). */
  projectLeadUserId = null,
  /** When set, restrict to these statuses server-side (e.g. ready-to-invoice → completed). */
  statuses = null,
  maxRows = 150,
  upcomingFrom = null,
}: {
  companyId: string
  search: string
  /** Local calendar date YYYY-MM-DD — overlap filter start (open-ended if dateTo is empty). */
  dateFrom?: string
  /**
   * Local calendar date YYYY-MM-DD — overlap filter end.
   * Empty with dateFrom means upcoming; set with empty dateFrom means past through that day.
   */
  dateTo?: string
  sortBy?: 'title' | 'start_at' | 'status' | 'customer_name'
  sortDir?: 'asc' | 'desc'
  userId?: string | null
  companyRole?: 'owner' | 'employee' | 'freelancer' | 'super_user' | null
  includeArchived?: boolean
  showOnlyArchived?: boolean
  onlyCrewForUserId?: string | null
  projectLeadUserId?: string | null
  statuses?: Array<JobListRow['status']> | null
  /**
   * Safety cap to avoid fetching an entire company’s job history in one request.
   * Use `jobsIndexPageQuery` for real pagination when you need full browsing.
   */
  maxRows?: number
  /** When set, only return in-progress jobs or jobs starting at/after this ISO timestamp. */
  upcomingFrom?: string | null
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'jobs-index',
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
      userId,
      companyRole,
      includeArchived,
      showOnlyArchived,
      onlyCrewForUserId,
      projectLeadUserId,
      statuses,
      maxRows,
      upcomingFrom,
    ],
    queryFn: async (): Promise<Array<JobListRow>> => {
      let q = supabase
        .from('jobs')
        .select(JOBS_LIST_SELECT)
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

      if (projectLeadUserId) {
        q = q.eq('project_lead_user_id', projectLeadUserId)
      }

      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses)
      }

      const dateOverlap = jobsIndexDateOverlapFilters(
        resolveJobsIndexDateOverlap(dateFrom, dateTo),
      )
      if (dateOverlap.notNullStart) {
        q = q.not('start_at', 'is', null)
      }
      if (dateOverlap.startAtLte) {
        q = q.lte('start_at', dateOverlap.startAtLte)
      }

      let searchOrFilter: string | null = null
      const fuzzyTerm = search.trim().replace(/^#/, '')
      if (fuzzyTerm) {
        const [customerIds, customerUserIds] = await Promise.all([
          findCustomerIdsByName(companyId, fuzzyTerm),
          findCustomerUserIdsBySearch(fuzzyTerm),
        ])
        searchOrFilter = jobsIndexSearchOrFilter({
          search: fuzzyTerm,
          customerIds,
          customerUserIds,
        })
      }
      const combinedOr = mergePostgrestAndOrFilters(
        searchOrFilter,
        dateOverlap.endAtOrFilter,
      )
      if (combinedOr) q = q.or(combinedOr)

      if (upcomingFrom) {
        q = q
          .neq('status', 'canceled')
          .or(`status.eq.in_progress,start_at.gte.${upcomingFrom}`)
      }

      // Sorting
      if (sortBy === 'customer_name') {
        // For customer name, we need to sort by the joined relation
        // PostgREST doesn't support sorting by joined columns directly,
        // so we'll sort client-side or use a different approach
        q = q.order('start_at', { ascending: sortDir === 'asc' })
      } else {
        q = q.order(sortBy, { ascending: sortDir === 'asc' })
      }

      // Safety cap: avoid returning unbounded rows from PostgREST.
      if (maxRows && maxRows > 0) {
        q = q.limit(maxRows)
      }

      const { data, error } = await q
      if (error) throw error

      let results = (data || []) as unknown as Array<JobListRow>

      // Client-side fuzzy filtering across title, customer name, customer user name, project lead name, status, and date
      // (PostgREST doesn't support filtering on joined columns like customer.name)
      if (fuzzyTerm) {
        const { fuzzySearch, makeWordPresentable } = await import(
          '@shared/lib/generalFunctions'
        )
        results = fuzzySearch(
          results,
          fuzzyTerm,
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

      if (companyRole === 'freelancer' && userId) {
        results = await restrictJobsIndexToFreelancer(results, userId)
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

        if (timePeriods.length > 0) {
          const timePeriodIds = timePeriods.map((tp: { id: string }) => tp.id)
          const { data: crewRes, error: crewError } = await supabase
            .from('reserved_crew')
            .select('time_period_id')
            .eq('user_id', onlyCrewForUserId)
            .in('time_period_id', timePeriodIds)

          if (crewError) throw crewError

          const jobIdsWithUserAsCrew = new Set<string>()
          crewRes.forEach((c: { time_period_id: string }) => {
            const tp = timePeriods.find(
              (t: { id: string; job_id: string | null }) =>
                t.id === c.time_period_id,
            )
            if (tp?.job_id) jobIdsWithUserAsCrew.add(tp.job_id)
          })
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

const JOBS_INDEX_SEARCH_ID_LIMIT = 100

/**
 * PostgREST `.or()` filter for the jobs index: title, numeric jobnr,
 * matching customer IDs, and matching customer-user IDs.
 */
const JOBS_INDEX_ID_IN_CHUNK = 100

/** PostgREST `.or()` filter for an ID allow-list, chunked to keep URLs short. */
export function jobsIndexIdInOrFilter(jobIds: Array<string>): string | null {
  if (jobIds.length === 0) return null
  const chunks: Array<string> = []
  for (let i = 0; i < jobIds.length; i += JOBS_INDEX_ID_IN_CHUNK) {
    chunks.push(
      `id.in.(${jobIds.slice(i, i + JOBS_INDEX_ID_IN_CHUNK).join(',')})`,
    )
  }
  return chunks.join(',')
}

/** AND together PostgREST `.or()` groups (a second `.or()` would overwrite the first). */
export function mergePostgrestAndOrFilters(
  ...filters: Array<string | null | undefined>
): string | null {
  const parts = filters.filter((item): item is string => !!item)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return `and(${parts.map((part) => `or(${part})`).join(',')})`
}

export function jobsIndexSearchOrFilter({
  search,
  customerIds = [],
  customerUserIds = [],
}: {
  search: string
  customerIds?: Array<string>
  customerUserIds?: Array<string>
}): string | null {
  const trimmed = search.trim().replace(/^#/, '')
  if (!trimmed) return null

  const orSafe = escapeForPostgrestOr(escapePgLike(trimmed))
  const parts = [`title.ilike.%${orSafe}%`]
  if (/^\d+$/.test(trimmed)) {
    parts.push(`jobnr.eq.${trimmed}`)
  }
  if (customerIds.length > 0) {
    parts.push(`customer_id.in.(${customerIds.join(',')})`)
  }
  if (customerUserIds.length > 0) {
    parts.push(`customer_user_id.in.(${customerUserIds.join(',')})`)
  }
  return parts.join(',')
}

async function findCustomerIdsByName(
  companyId: string,
  search: string,
): Promise<Array<string>> {
  const orSafe = escapeForPostgrestOr(escapePgLike(search.trim()))
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .or('deleted.is.null,deleted.eq.false')
    .ilike('name', `%${orSafe}%`)
    .limit(JOBS_INDEX_SEARCH_ID_LIMIT)
  if (error) throw error
  return data.map((row) => row.id)
}

async function findCustomerUserIdsBySearch(
  search: string,
): Promise<Array<string>> {
  const orSafe = escapeForPostgrestOr(escapePgLike(search.trim()))
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .or(`display_name.ilike.%${orSafe}%,email.ilike.%${orSafe}%`)
    .limit(JOBS_INDEX_SEARCH_ID_LIMIT)
  if (error) throw error
  return data.map((row) => row.user_id)
}

type JobsIndexListParams = {
  companyId: string
  page: number
  pageSize: number
  search: string
  dateFrom?: string
  dateTo?: string
  sortBy?: JobsIndexSortBy
  sortDir?: JobsIndexSortDir
  userId?: string | null
  companyRole?: 'owner' | 'employee' | 'freelancer' | 'super_user' | null
  includeArchived?: boolean
  showOnlyArchived?: boolean
  projectLeadUserId?: string | null
  statuses?: Array<JobListRow['status']> | null
  /** When false, hide jobs that belong to a recurring series. Default true. */
  includeRecurringMembers?: boolean
  /** When set, only these job IDs (e.g. My jobs: crew or project lead). */
  onlyJobIds?: Array<string> | null
}

async function fetchJobsIndexPage({
  companyId,
  page,
  pageSize,
  search,
  dateFrom,
  dateTo,
  sortBy = 'start_at',
  sortDir = 'desc',
  userId,
  companyRole,
  includeArchived = false,
  showOnlyArchived = false,
  projectLeadUserId = null,
  statuses = null,
  includeRecurringMembers = true,
  onlyJobIds = null,
}: JobsIndexListParams): Promise<JobsIndexPageResult> {
  const from = Math.max(0, (page - 1) * pageSize)
  const to = Math.max(from, from + pageSize - 1)

  if (onlyJobIds && onlyJobIds.length === 0) {
    return { rows: [], count: 0, fetched: 0, page }
  }

  let q = supabase
    .from('jobs')
    .select(JOBS_LIST_SELECT, { count: 'exact' })
    .eq('company_id', companyId)

  const idFilter = onlyJobIds ? jobsIndexIdInOrFilter(onlyJobIds) : null

  if (showOnlyArchived) {
    q = q.eq('archived', true)
  } else if (!includeArchived) {
    q = q.eq('archived', false)
  }

  if (projectLeadUserId) {
    q = q.eq('project_lead_user_id', projectLeadUserId)
  }

  if (!includeRecurringMembers) {
    q = q.is('recurring_job_id', null)
  }

  if (statuses && statuses.length > 0) {
    q = q.in('status', statuses)
  }

  const dateOverlap = jobsIndexDateOverlapFilters(
    resolveJobsIndexDateOverlap(dateFrom, dateTo),
  )
  if (dateOverlap.notNullStart) {
    q = q.not('start_at', 'is', null)
  }
  if (dateOverlap.startAtLte) {
    q = q.lte('start_at', dateOverlap.startAtLte)
  }

  let searchOrFilter: string | null = null
  const indexSearch = search.trim().replace(/^#/, '')
  if (indexSearch) {
    const [customerIds, customerUserIds] = await Promise.all([
      findCustomerIdsByName(companyId, indexSearch),
      findCustomerUserIdsBySearch(indexSearch),
    ])
    searchOrFilter = jobsIndexSearchOrFilter({
      search: indexSearch,
      customerIds,
      customerUserIds,
    })
  }
  const combinedOr = mergePostgrestAndOrFilters(
    idFilter,
    searchOrFilter,
    dateOverlap.endAtOrFilter,
  )
  if (combinedOr) q = q.or(combinedOr)

  if (sortBy === 'customer_name') {
    q = q.order('start_at', { ascending: sortDir === 'asc' })
  } else {
    q = q.order(sortBy, { ascending: sortDir === 'asc' })
  }

  const { data, error, count } = await q.range(from, to)
  if (error) throw error

  let rows = data as unknown as Array<JobListRow>
  const fetched = rows.length

  if (companyRole === 'freelancer' && userId) {
    rows = await restrictJobsIndexToFreelancer(rows, userId)
  }

  return { rows, count: count ?? 0, fetched, page }
}

export function jobsIndexPageQuery({
  companyId,
  page,
  pageSize,
  search,
  dateFrom,
  dateTo,
  sortBy = 'start_at',
  sortDir = 'desc',
  userId,
  companyRole,
  includeArchived = false,
  showOnlyArchived = false,
  onlyCrewForUserId = null,
  projectLeadUserId = null,
  statuses = null,
}: {
  companyId: string
  page: number
  pageSize: number
  search: string
  /** Local calendar date YYYY-MM-DD — overlap filter start (open-ended if dateTo is empty). */
  dateFrom?: string
  /**
   * Local calendar date YYYY-MM-DD — overlap filter end.
   * Empty with dateFrom means upcoming; set with empty dateFrom means past through that day.
   */
  dateTo?: string
  sortBy?: JobsIndexSortBy
  sortDir?: JobsIndexSortDir
  userId?: string | null
  companyRole?: 'owner' | 'employee' | 'freelancer' | 'super_user' | null
  includeArchived?: boolean
  showOnlyArchived?: boolean
  onlyCrewForUserId?: string | null
  projectLeadUserId?: string | null
  statuses?: Array<JobListRow['status']> | null
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'jobs-index-page',
      page,
      pageSize,
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
      userId,
      companyRole,
      includeArchived,
      showOnlyArchived,
      onlyCrewForUserId,
      projectLeadUserId,
      statuses,
    ] as const,
    queryFn: () =>
      fetchJobsIndexPage({
        companyId,
        page,
        pageSize,
        search,
        dateFrom,
        dateTo,
        sortBy,
        sortDir,
        userId,
        companyRole,
        includeArchived,
        showOnlyArchived,
        projectLeadUserId,
        statuses,
      }),
    staleTime: 10_000,
  }
}

export function getJobsIndexNextPageParam(
  lastPage: JobsIndexPageResult,
  _allPages: Array<JobsIndexPageResult>,
  pageSize: number = JOBS_INDEX_INFINITE_PAGE_SIZE,
): number | undefined {
  // Page while this response filled the requested range. Do not trust
  // PostgREST counts for hasNextPage — estimated counts can under-report
  // and would stop infinite scroll early.
  if (lastPage.fetched === 0) return undefined
  if (lastPage.fetched < pageSize) return undefined
  return lastPage.page + 1
}

export function jobsIndexInfiniteQuery({
  companyId,
  search = '',
  dateFrom,
  dateTo,
  sortBy = 'start_at',
  sortDir = 'desc',
  userId,
  companyRole,
  showOnlyArchived = false,
  projectLeadUserId = null,
  statuses = null,
  includeRecurringMembers = true,
  onlyJobIds = null,
  pageSize = JOBS_INDEX_INFINITE_PAGE_SIZE,
}: {
  companyId: string
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: JobsIndexSortBy
  sortDir?: JobsIndexSortDir
  userId?: string | null
  companyRole?: 'owner' | 'employee' | 'freelancer' | 'super_user' | null
  showOnlyArchived?: boolean
  projectLeadUserId?: string | null
  statuses?: Array<JobListRow['status']> | null
  includeRecurringMembers?: boolean
  onlyJobIds?: Array<string> | null
  pageSize?: number
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'jobs-index-infinite',
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
      userId,
      companyRole,
      showOnlyArchived,
      projectLeadUserId,
      statuses,
      includeRecurringMembers,
      onlyJobIds,
      pageSize,
    ] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      fetchJobsIndexPage({
        companyId,
        page: pageParam,
        pageSize,
        search,
        dateFrom,
        dateTo,
        sortBy,
        sortDir,
        userId,
        companyRole,
        showOnlyArchived,
        projectLeadUserId,
        statuses,
        includeRecurringMembers,
        onlyJobIds,
      }),
    getNextPageParam: (
      lastPage: JobsIndexPageResult,
      allPages: Array<JobsIndexPageResult>,
    ) => getJobsIndexNextPageParam(lastPage, allPages, pageSize),
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
          id, company_id, title, jobnr, description, status, start_at, end_at, archived, invoice_basis, recurring_job_id,
          project_lead_user_id, customer_id, customer_user_id, customer_contact_id, job_address_id,
          customer:customer_id ( id, name, email, phone, address, vat_number, conta_customer_id, conta_days_until_payment_reminder ),
          customer_user:customer_user_id ( user_id, display_name, email, phone ),
          project_lead:project_lead_user_id ( user_id, display_name, email ),
          customer_contact:customer_contact_id ( id, name, email, phone, title ),
          address:job_address_id ( id, name, address_line, zip_code, city, country ),
          recurring_job:recurring_job_id ( id, title )
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
        .select(
          'id, company_id, job_id, title, start_at, end_at, category, program_group, needed_count, role_category, notes',
        )
        .eq('job_id', jobId)
        .eq('deleted', false)
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
  program_group?: string | null
  needed_count?: number | null
  role_category?: string | null
  notes?: string | null
}) {
  if (payload.id) {
    const { error } = await supabase
      .from('time_periods')
      .update({
        title: payload.title,
        start_at: payload.start_at,
        end_at: payload.end_at,
        program_group: payload.program_group ?? null,
        needed_count: payload.needed_count ?? null,
        role_category: payload.role_category ?? null,
        notes: payload.notes ?? null,
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
        program_group: payload.program_group ?? null,
        needed_count: payload.needed_count ?? null,
        role_category: payload.role_category ?? null,
        notes: payload.notes ?? null,
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
}

export const DEFAULT_EQUIPMENT_PERIOD_TITLE = 'Equipment period'

/**
 * Ensure the job has a default equipment period spanning job start/end.
 * Returns the period id (existing or newly created).
 */
export async function ensureDefaultEquipmentPeriod(params: {
  jobId: string
  companyId: string
  startAt: string
  endAt: string
}): Promise<string> {
  const { data: existing, error: existingErr } = await supabase
    .from('time_periods')
    .select('id')
    .eq('job_id', params.jobId)
    .eq('deleted', false)
    .eq('category', 'equipment')
    .eq('title', DEFAULT_EQUIPMENT_PERIOD_TITLE)
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existingErr) throw existingErr
  if (existing?.id) return existing.id

  return upsertTimePeriod({
    job_id: params.jobId,
    company_id: params.companyId,
    title: DEFAULT_EQUIPMENT_PERIOD_TITLE,
    start_at: params.startAt,
    end_at: params.endAt,
    category: 'equipment',
  })
}

export type { CopyJobResult }

export async function copyJob(payload: {
  jobId: string
  startAt: string // ISO
  title: string
}): Promise<CopyJobResult> {
  const { data, error } = await supabase.rpc('job_copy', {
    p_job_id: payload.jobId,
    p_start_at: payload.startAt,
    p_title: payload.title.trim(),
  })
  if (error) throw error
  return parseCopyJobRpcResult(data)
}

/** Permanently delete a job and its direct booking data. */
export async function deleteJobById(jobId: string): Promise<void> {
  const { error: mattersErr } = await supabase
    .from('matters')
    .delete()
    .eq('job_id', jobId)
    .eq('matter_type', 'crew_invite')
  if (mattersErr) throw mattersErr

  const { error: periodsErr } = await supabase
    .from('time_periods')
    .delete()
    .eq('job_id', jobId)
  if (periodsErr) throw periodsErr

  const { error: jobErr } = await supabase.from('jobs').delete().eq('id', jobId)
  if (jobErr) throw jobErr
}
