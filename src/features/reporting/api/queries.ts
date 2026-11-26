import { queryOptions } from '@tanstack/react-query'
import { fetchAllInChunks } from '@shared/api/inFilterChunks'
import { supabase } from '@shared/api/supabase'
import { aggregateCustomerProfitabilityFromJobs } from '../utils/customers'
import {
  assumedCapacityHours,
  clippedHours,
  monthKeyFromDate,
  monthLabelFromKey,
  rangeBounds,
} from '../utils/dates'
import { formatJobNumber, marginPct } from '../utils/format'
import { isMoneyIncompleteJob } from '../utils/incompleteness'
import { requireCompanyId } from '../utils/requireCompanyId'
import type {
  CustomerProfitabilityRow,
  InvoicePipelineBucket,
  InvoicePipelineJobRow,
  InvoicePipelineResult,
  InvoicePipelineSummary,
  JobProfitabilityRow,
  MonthlyTrendRow,
  UtilizationRow,
} from '../types'

type ProjectLeadJoin = {
  user_id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
}

type RecurringJobJoin = {
  id: string
  title: string
  accounting_mode: 'per_job' | 'combined' | null
  money_verified_at: string | null
  period_start: string | null
  period_end: string | null
  project_lead_user_id: string | null
  customer_id: string | null
  customer: { name: string } | Array<{ name: string }> | null
  project_lead: ProjectLeadJoin | Array<ProjectLeadJoin> | null
}

type JobRow = {
  id: string
  jobnr: number | null
  title: string
  start_at: string | null
  end_at: string | null
  customer_id: string | null
  status?: string
  money_verified_at?: string | null
  recurring_job_id?: string | null
  customer: { name: string } | Array<{ name: string }> | null
  project_lead: ProjectLeadJoin | Array<ProjectLeadJoin> | null
  recurring_job?: RecurringJobJoin | Array<RecurringJobJoin> | null
}

function customerNameFromJoin(customer: JobRow['customer']): string | null {
  if (customer == null) return null
  if (Array.isArray(customer)) {
    return customer[0]?.name ?? null
  }
  return customer.name ?? null
}

/** Same fallback order as JobsList: display_name → email → Unassigned. */
function projectLeadNameFromJoin(projectLead: JobRow['project_lead']): string {
  const lead = Array.isArray(projectLead) ? projectLead[0] : projectLead
  if (!lead) return 'Unassigned'
  return lead.display_name || lead.email || 'Unassigned'
}

function projectLeadAvatarFromJoin(
  projectLead: JobRow['project_lead'],
): string | null {
  const lead = Array.isArray(projectLead) ? projectLead[0] : projectLead
  return lead?.avatar_url ?? null
}

function jobOverlapsRange(
  startAt: string | null,
  endAt: string | null,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  // Exclude jobs with both dates null from ranged reports
  if (startAt == null && endAt == null) return false
  const start = startAt ? new Date(startAt).getTime() : null
  const end = endAt ? new Date(endAt).getTime() : null
  if (start != null && end != null) {
    return start <= rangeEnd && end >= rangeStart
  }
  if (start != null) return start <= rangeEnd
  return end != null && end >= rangeStart
}

async function fetchOverlappingJobs({
  companyId,
  fromDate,
  toDate,
  includeStatus = false,
  projectLeadUserId = null,
}: {
  companyId: string
  fromDate: string
  toDate: string
  includeStatus?: boolean
  /** When set, only jobs where this user is project lead. */
  projectLeadUserId?: string | null
}): Promise<Array<JobRow>> {
  const scopedCompanyId = requireCompanyId(companyId)
  const { from, to } = rangeBounds(fromDate, toDate)
  const rangeStart = from.getTime()
  const rangeEnd = to.getTime()

  const recurringJoin =
    'recurring_job:recurring_job_id ( id, title, accounting_mode, money_verified_at, period_start, period_end, project_lead_user_id, customer_id, customer:customer_id(name), project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url ) )'
  const select = includeStatus
    ? `id, jobnr, title, start_at, end_at, customer_id, status, money_verified_at, recurring_job_id, customer:customers(name), project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url ), ${recurringJoin}`
    : `id, jobnr, title, start_at, end_at, customer_id, money_verified_at, recurring_job_id, customer:customers(name), project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url ), ${recurringJoin}`

  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  // Server-side overlap prefilter (still re-check in JS for both-null / edge cases).
  // (start is null OR start <= rangeEnd) AND (end is null OR end >= rangeStart)
  let q = supabase
    .from('jobs')
    .select(select)
    .eq('company_id', scopedCompanyId)
    .eq('archived', false)
    .or(`start_at.is.null,start_at.lte.${toIso}`)
    .or(`end_at.is.null,end_at.gte.${fromIso}`)

  if (projectLeadUserId) {
    q = q.eq('project_lead_user_id', projectLeadUserId)
  }

  const { data: jobs, error } = await q

  if (error) throw error
  if (!jobs?.length) return []

  return (jobs as unknown as Array<JobRow>).filter((job) =>
    jobOverlapsRange(job.start_at, job.end_at, rangeStart, rangeEnd),
  )
}

function projectLeadUserIdFromJoin(
  projectLead: JobRow['project_lead'],
): string | null {
  const lead = Array.isArray(projectLead) ? projectLead[0] : projectLead
  return lead?.user_id ?? null
}

export type ProjectLeadOption = {
  user_id: string
  display_name: string | null
  email: string
  role: string
}

/**
 * Company members eligible as project leads (same as Job / Recurring dialogs:
 * everyone except freelancers — employees, owners, super_users).
 */
export function reportProjectLeadsQuery({ companyId }: { companyId: string }) {
  return queryOptions<Array<ProjectLeadOption>>({
    queryKey: ['company', companyId, 'project-leads'],
    queryFn: async () => {
      const scopedCompanyId = requireCompanyId(companyId)
      const { data, error } = await supabase
        .from('company_user_profiles')
        .select('user_id, display_name, email, role')
        .eq('company_id', scopedCompanyId)
        .neq('role', 'freelancer')
        .order('display_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<ProjectLeadOption>
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

type MoneyTotals = {
  income: number
  expenses: number
  itemCount: number
}

async function fetchMoneyTotalsByJob(
  jobIds: Array<string>,
): Promise<Map<string, MoneyTotals>> {
  const byJob = new Map<string, MoneyTotals>()
  for (const id of jobIds) {
    byJob.set(id, { income: 0, expenses: 0, itemCount: 0 })
  }
  if (jobIds.length === 0) return byJob

  const items = await fetchAllInChunks(jobIds, (chunk) =>
    supabase
      .from('job_money_items')
      .select('job_id, type, amount')
      .in('job_id', chunk),
  )

  for (const row of items) {
    if (!row.job_id) continue
    const cur = byJob.get(row.job_id)
    if (!cur) continue
    cur.itemCount += 1
    if (row.type === 'income') cur.income += Number(row.amount)
    else if (row.type === 'expense') cur.expenses += Number(row.amount)
  }

  return byJob
}

async function fetchMoneyTotalsByRecurringJob(
  recurringJobIds: Array<string>,
): Promise<Map<string, MoneyTotals>> {
  const bySeries = new Map<string, MoneyTotals>()
  for (const id of recurringJobIds) {
    bySeries.set(id, { income: 0, expenses: 0, itemCount: 0 })
  }
  if (recurringJobIds.length === 0) return bySeries

  const items = await fetchAllInChunks(recurringJobIds, (chunk) =>
    supabase
      .from('job_money_items')
      .select('recurring_job_id, type, amount')
      .in('recurring_job_id', chunk),
  )

  for (const row of items) {
    if (!row.recurring_job_id) continue
    const cur = bySeries.get(row.recurring_job_id)
    if (!cur) continue
    cur.itemCount += 1
    if (row.type === 'income') cur.income += Number(row.amount)
    else if (row.type === 'expense') cur.expenses += Number(row.amount)
  }

  return bySeries
}

function recurringJobFromJoin(
  recurringJob: JobRow['recurring_job'],
): RecurringJobJoin | null {
  if (recurringJob == null) return null
  return Array.isArray(recurringJob) ? (recurringJob[0] ?? null) : recurringJob
}

function toJobProfitabilityRow(
  job: JobRow,
  money: MoneyTotals,
): JobProfitabilityRow {
  const income = money.income
  const expenses = money.expenses
  const profit = income - expenses
  const status = job.status ?? null
  return {
    job_id: job.id,
    job_number: formatJobNumber(job.jobnr),
    title: job.title,
    customer_id: job.customer_id ?? null,
    customer_name: customerNameFromJoin(job.customer),
    project_lead_user_id: projectLeadUserIdFromJoin(job.project_lead),
    project_lead_name: projectLeadNameFromJoin(job.project_lead),
    project_lead_avatar_url: projectLeadAvatarFromJoin(job.project_lead),
    start_at: job.start_at ?? null,
    end_at: job.end_at ?? null,
    status,
    income,
    expenses,
    profit,
    margin_pct: marginPct(income, profit),
    money_item_count: money.itemCount,
    money_incomplete: isMoneyIncompleteJob({
      status,
      income,
      itemCount: money.itemCount,
    }),
    money_verified: job.money_verified_at != null,
    money_verified_at: job.money_verified_at ?? null,
    accounting_scope: 'job',
    recurring_job_id: job.recurring_job_id ?? null,
  }
}

function toCombinedSeriesProfitabilityRow(
  series: RecurringJobJoin,
  money: MoneyTotals,
  childStatuses: Array<string>,
): JobProfitabilityRow {
  const income = money.income
  const expenses = money.expenses
  const profit = income - expenses
  // Prefer an eligible child status for incompleteness; else first child.
  const status =
    childStatuses.find((s) =>
      ['completed', 'invoiced', 'paid', 'canceled'].includes(s),
    ) ??
    childStatuses[0] ??
    null
  return {
    job_id: series.id,
    job_number: 'Series',
    title: series.title,
    customer_id: series.customer_id ?? null,
    customer_name: customerNameFromJoin(series.customer),
    project_lead_user_id: projectLeadUserIdFromJoin(series.project_lead),
    project_lead_name: projectLeadNameFromJoin(series.project_lead),
    project_lead_avatar_url: projectLeadAvatarFromJoin(series.project_lead),
    start_at: series.period_start ?? null,
    end_at: series.period_end ?? null,
    status,
    income,
    expenses,
    profit,
    margin_pct: marginPct(income, profit),
    money_item_count: money.itemCount,
    money_incomplete: isMoneyIncompleteJob({
      status,
      income,
      itemCount: money.itemCount,
    }),
    money_verified: series.money_verified_at != null,
    money_verified_at: series.money_verified_at ?? null,
    accounting_scope: 'combined_series',
    recurring_job_id: series.id,
  }
}

/**
 * Shared fetch used by job + customer profitability queries.
 */
export async function fetchJobProfitabilityRows({
  companyId,
  fromDate,
  toDate,
  projectLeadUserId = null,
}: {
  companyId: string
  fromDate: string
  toDate: string
  projectLeadUserId?: string | null
}): Promise<Array<JobProfitabilityRow>> {
  const scopedCompanyId = requireCompanyId(companyId)
  const overlapping = await fetchOverlappingJobs({
    companyId: scopedCompanyId,
    fromDate,
    toDate,
    includeStatus: true,
    projectLeadUserId,
  })

  const perJobJobs: Array<JobRow> = []
  const combinedSeriesById = new Map<
    string,
    { series: RecurringJobJoin; childStatuses: Array<string> }
  >()

  for (const job of overlapping) {
    const series = recurringJobFromJoin(job.recurring_job)
    if (series?.accounting_mode === 'combined' && job.recurring_job_id) {
      if (
        projectLeadUserId &&
        series.project_lead_user_id !== projectLeadUserId
      ) {
        continue
      }
      const existing = combinedSeriesById.get(job.recurring_job_id)
      if (existing) {
        if (job.status) existing.childStatuses.push(job.status)
      } else {
        combinedSeriesById.set(job.recurring_job_id, {
          series,
          childStatuses: job.status ? [job.status] : [],
        })
      }
      continue
    }
    perJobJobs.push(job)
  }

  const jobIds = perJobJobs.map((j) => j.id)
  const seriesIds = [...combinedSeriesById.keys()]
  const [byJob, bySeries] = await Promise.all([
    fetchMoneyTotalsByJob(jobIds),
    fetchMoneyTotalsByRecurringJob(seriesIds),
  ])

  const jobRows = perJobJobs.map((job) =>
    toJobProfitabilityRow(
      job,
      byJob.get(job.id) ?? { income: 0, expenses: 0, itemCount: 0 },
    ),
  )

  const seriesRows = [...combinedSeriesById.values()].map(
    ({ series, childStatuses }) =>
      toCombinedSeriesProfitabilityRow(
        series,
        bySeries.get(series.id) ?? {
          income: 0,
          expenses: 0,
          itemCount: 0,
        },
        childStatuses,
      ),
  )

  return [...jobRows, ...seriesRows]
}

export function reportJobProfitabilityQuery({
  companyId,
  fromDate,
  toDate,
  projectLeadUserId = null,
}: {
  companyId: string
  fromDate: string
  toDate: string
  projectLeadUserId?: string | null
}) {
  return queryOptions<Array<JobProfitabilityRow>>({
    queryKey: [
      'reporting',
      'job-profitability',
      companyId,
      fromDate,
      toDate,
      projectLeadUserId,
    ],
    queryFn: () =>
      fetchJobProfitabilityRows({
        companyId,
        fromDate,
        toDate,
        projectLeadUserId,
      }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function reportCustomerProfitabilityQuery({
  companyId,
  fromDate,
  toDate,
  projectLeadUserId = null,
}: {
  companyId: string
  fromDate: string
  toDate: string
  projectLeadUserId?: string | null
}) {
  return queryOptions<Array<CustomerProfitabilityRow>>({
    queryKey: [
      'reporting',
      'customer-profitability',
      companyId,
      fromDate,
      toDate,
      projectLeadUserId,
    ],
    queryFn: async (): Promise<Array<CustomerProfitabilityRow>> => {
      const jobRows = await fetchJobProfitabilityRows({
        companyId,
        fromDate,
        toDate,
        projectLeadUserId,
      })
      return aggregateCustomerProfitabilityFromJobs(jobRows)
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function reportUtilizationQuery({
  companyId,
  fromDate,
  toDate,
}: {
  companyId: string
  fromDate: string
  toDate: string
}) {
  return queryOptions<Array<UtilizationRow>>({
    queryKey: ['reporting', 'utilization', companyId, fromDate, toDate],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Array<UtilizationRow>> => {
      const scopedCompanyId = requireCompanyId(companyId)
      const { fromISO, toISO, from, to } = rangeBounds(fromDate, toDate)
      const rangeStartMs = from.getTime()
      const rangeEndMs = to.getTime()
      const capacity = assumedCapacityHours(fromDate, toDate)

      const { data: periods, error: periodsError } = await supabase
        .from('time_periods')
        .select('id, start_at, end_at')
        .eq('company_id', scopedCompanyId)
        .eq('deleted', false)
        .lte('start_at', toISO)
        .gte('end_at', fromISO)

      if (periodsError) throw periodsError
      if (!periods?.length) return []

      const periodIds = periods.map((p) => p.id)
      const periodMap = new Map(periods.map((p) => [p.id, p]))

      // Chunk `.in(time_period_id)` — a full year of periods easily exceeds
      // PostgREST/Kong URL limits and surfaces as HTTP 400 in the browser.
      const crew = await fetchAllInChunks(periodIds, (chunk) =>
        supabase
          .from('reserved_crew')
          .select('user_id, time_period_id, status')
          .in('time_period_id', chunk)
          .not('user_id', 'is', null)
          .neq('status', 'canceled'),
      )
      if (!crew.length) return []

      const hoursByUser = new Map<string, number>()
      for (const row of crew) {
        const uid = row.user_id as string
        const period = periodMap.get(row.time_period_id)
        if (!period?.start_at || !period?.end_at) continue
        const start = new Date(period.start_at).getTime()
        const end = new Date(period.end_at).getTime()
        const hours = clippedHours(start, end, rangeStartMs, rangeEndMs)
        if (hours <= 0) continue
        hoursByUser.set(uid, (hoursByUser.get(uid) ?? 0) + hours)
      }

      const userIds = Array.from(hoursByUser.keys())
      if (userIds.length === 0) return []

      const profiles = await fetchAllInChunks(userIds, (chunk) =>
        supabase
          .from('profiles')
          .select('user_id, display_name, first_name, last_name')
          .in('user_id', chunk),
      )

      const nameByUser = new Map<string, string | null>()
      for (const p of profiles) {
        const name =
          p.display_name ??
          ([p.first_name, p.last_name].filter(Boolean).join(' ') || null)
        nameByUser.set(p.user_id, name)
      }

      return userIds
        .map((user_id) => {
          const booked = Math.round((hoursByUser.get(user_id) ?? 0) * 100) / 100
          const utilization_pct =
            capacity > 0 ? Math.round((booked / capacity) * 10000) / 100 : null
          return {
            user_id,
            display_name: nameByUser.get(user_id) ?? null,
            booked_hours: booked,
            capacity_hours: capacity,
            utilization_pct,
          }
        })
        .sort((a, b) => b.booked_hours - a.booked_hours)
    },
  })
}

export function reportMonthlyTrendQuery({
  companyId,
  fromDate,
  toDate,
  projectLeadUserId = null,
}: {
  companyId: string
  fromDate: string
  toDate: string
  projectLeadUserId?: string | null
}) {
  return queryOptions<Array<MonthlyTrendRow>>({
    queryKey: [
      'reporting',
      'monthly-trend',
      companyId,
      fromDate,
      toDate,
      projectLeadUserId,
    ],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Array<MonthlyTrendRow>> => {
      const scopedCompanyId = requireCompanyId(companyId)
      const { fromISO, toISO } = rangeBounds(fromDate, toDate)

      // Monthly P&L chart: verified job ledger + verified combined-series ledger.
      const jobSelect =
        'type, amount, date, created_at, jobs!inner(money_verified_at, project_lead_user_id)'
      const seriesSelect =
        'type, amount, date, created_at, recurring_jobs!inner(money_verified_at, project_lead_user_id, accounting_mode)'

      let datedJobQ = supabase
        .from('job_money_items')
        .select(jobSelect)
        .eq('company_id', scopedCompanyId)
        .not('job_id', 'is', null)
        .not('date', 'is', null)
        .gte('date', fromISO)
        .lte('date', toISO)
        .not('jobs.money_verified_at', 'is', null)

      let undatedJobQ = supabase
        .from('job_money_items')
        .select(jobSelect)
        .eq('company_id', scopedCompanyId)
        .not('job_id', 'is', null)
        .is('date', null)
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .not('jobs.money_verified_at', 'is', null)

      let datedSeriesQ = supabase
        .from('job_money_items')
        .select(seriesSelect)
        .eq('company_id', scopedCompanyId)
        .not('recurring_job_id', 'is', null)
        .not('date', 'is', null)
        .gte('date', fromISO)
        .lte('date', toISO)
        .eq('recurring_jobs.accounting_mode', 'combined')
        .not('recurring_jobs.money_verified_at', 'is', null)

      let undatedSeriesQ = supabase
        .from('job_money_items')
        .select(seriesSelect)
        .eq('company_id', scopedCompanyId)
        .not('recurring_job_id', 'is', null)
        .is('date', null)
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .eq('recurring_jobs.accounting_mode', 'combined')
        .not('recurring_jobs.money_verified_at', 'is', null)

      if (projectLeadUserId) {
        datedJobQ = datedJobQ.eq('jobs.project_lead_user_id', projectLeadUserId)
        undatedJobQ = undatedJobQ.eq(
          'jobs.project_lead_user_id',
          projectLeadUserId,
        )
        datedSeriesQ = datedSeriesQ.eq(
          'recurring_jobs.project_lead_user_id',
          projectLeadUserId,
        )
        undatedSeriesQ = undatedSeriesQ.eq(
          'recurring_jobs.project_lead_user_id',
          projectLeadUserId,
        )
      }

      const [datedJobRes, undatedJobRes, datedSeriesRes, undatedSeriesRes] =
        await Promise.all([
          datedJobQ,
          undatedJobQ,
          datedSeriesQ,
          undatedSeriesQ,
        ])

      if (datedJobRes.error) throw datedJobRes.error
      if (undatedJobRes.error) throw undatedJobRes.error
      if (datedSeriesRes.error) throw datedSeriesRes.error
      if (undatedSeriesRes.error) throw undatedSeriesRes.error

      const items = [
        ...(datedJobRes.data ?? []),
        ...(undatedJobRes.data ?? []),
        ...(datedSeriesRes.data ?? []),
        ...(undatedSeriesRes.data ?? []),
      ]
      const monthly = new Map<string, { income: number; expenses: number }>()
      for (const item of items) {
        const raw = item.date || item.created_at
        const d = new Date(raw)
        const key = monthKeyFromDate(d)
        if (!monthly.has(key)) {
          monthly.set(key, { income: 0, expenses: 0 })
        }
        const cur = monthly.get(key)!
        if (item.type === 'income') cur.income += Number(item.amount)
        else if (item.type === 'expense') cur.expenses += Number(item.amount)
      }

      return Array.from(monthly.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month_key, cur]) => ({
          month_key,
          month_label: monthLabelFromKey(month_key),
          income: cur.income,
          expenses: cur.expenses,
          profit: cur.income - cur.expenses,
        }))
    },
  })
}

const PIPELINE_BUCKETS: Array<{
  bucket: InvoicePipelineBucket
  label: string
  statuses: Array<string>
}> = [
  {
    bucket: 'active',
    label: 'Active',
    statuses: ['draft', 'planned', 'requested', 'confirmed', 'in_progress'],
  },
  { bucket: 'ready', label: 'Ready to invoice', statuses: ['completed'] },
  { bucket: 'invoiced', label: 'Invoiced', statuses: ['invoiced'] },
  { bucket: 'paid', label: 'Paid', statuses: ['paid'] },
  { bucket: 'canceled', label: 'Canceled', statuses: ['canceled'] },
]

function statusToBucket(status: string): InvoicePipelineBucket | null {
  for (const b of PIPELINE_BUCKETS) {
    if (b.statuses.includes(status)) return b.bucket
  }
  return null
}

export function reportInvoicePipelineQuery({
  companyId,
  fromDate,
  toDate,
  projectLeadUserId = null,
}: {
  companyId: string
  fromDate: string
  toDate: string
  projectLeadUserId?: string | null
}) {
  return queryOptions<InvoicePipelineResult>({
    queryKey: [
      'reporting',
      'invoice-pipeline',
      companyId,
      fromDate,
      toDate,
      projectLeadUserId,
    ],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<InvoicePipelineResult> => {
      const overlapping = await fetchOverlappingJobs({
        companyId,
        fromDate,
        toDate,
        includeStatus: true,
        projectLeadUserId,
      })

      const jobIds = overlapping.map((j) => j.id)
      const byJob = await fetchMoneyTotalsByJob(jobIds)

      const jobs: Array<InvoicePipelineJobRow> = []
      for (const job of overlapping) {
        const status = job.status ?? 'draft'
        const bucket = statusToBucket(status)
        if (!bucket) continue
        const money = byJob.get(job.id) ?? { income: 0, expenses: 0 }
        jobs.push({
          job_id: job.id,
          job_number: formatJobNumber(job.jobnr),
          title: job.title,
          customer_name: customerNameFromJoin(job.customer),
          status,
          bucket,
          start_at: job.start_at ?? null,
          end_at: job.end_at ?? null,
          income: money.income,
        })
      }

      const summaries: Array<InvoicePipelineSummary> = PIPELINE_BUCKETS.map(
        (b) => {
          const inBucket = jobs.filter((j) => j.bucket === b.bucket)
          return {
            bucket: b.bucket,
            label: b.label,
            job_count: inBucket.length,
            income: inBucket.reduce((sum, j) => sum + j.income, 0),
          }
        },
      )

      return { summaries, jobs }
    },
  })
}
