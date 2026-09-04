import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  assumedCapacityHours,
  clippedHours,
  monthKeyFromDate,
  monthLabelFromKey,
  rangeBounds,
} from '../utils/dates'
import { formatJobNumber, marginPct } from '../utils/format'
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

type JobRow = {
  id: string
  jobnr: number | null
  title: string
  start_at: string | null
  end_at: string | null
  customer_id: string | null
  status?: string
  customer: { name: string } | Array<{ name: string }> | null
}

function customerNameFromJoin(customer: JobRow['customer']): string | null {
  if (customer == null) return null
  if (Array.isArray(customer)) {
    return customer[0]?.name ?? null
  }
  return customer.name ?? null
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
}: {
  companyId: string
  fromDate: string
  toDate: string
  includeStatus?: boolean
}): Promise<Array<JobRow>> {
  const { from, to } = rangeBounds(fromDate, toDate)
  const rangeStart = from.getTime()
  const rangeEnd = to.getTime()

  const select = includeStatus
    ? 'id, jobnr, title, start_at, end_at, customer_id, status, customer:customers(name)'
    : 'id, jobnr, title, start_at, end_at, customer_id, customer:customers(name)'

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(select)
    .eq('company_id', companyId)
    .eq('archived', false)

  if (error) throw error
  if (!jobs?.length) return []

  return (jobs as unknown as Array<JobRow>).filter((job) =>
    jobOverlapsRange(job.start_at, job.end_at, rangeStart, rangeEnd),
  )
}

async function fetchMoneyTotalsByJob(
  jobIds: Array<string>,
): Promise<Map<string, { income: number; expenses: number }>> {
  const byJob = new Map<string, { income: number; expenses: number }>()
  for (const id of jobIds) {
    byJob.set(id, { income: 0, expenses: 0 })
  }
  if (jobIds.length === 0) return byJob

  // Chunk to stay under PostgREST URL limits for large companies
  const chunkSize = 200
  for (let i = 0; i < jobIds.length; i += chunkSize) {
    const chunk = jobIds.slice(i, i + chunkSize)
    const { data: items, error } = await supabase
      .from('job_money_items')
      .select('job_id, type, amount')
      .in('job_id', chunk)

    if (error) throw error

    for (const row of items ?? []) {
      const cur = byJob.get(row.job_id)
      if (!cur) continue
      if (row.type === 'income') cur.income += Number(row.amount)
      else if (row.type === 'expense') cur.expenses += Number(row.amount)
    }
  }

  return byJob
}

function toJobProfitabilityRow(
  job: JobRow,
  money: { income: number; expenses: number },
): JobProfitabilityRow {
  const income = money.income
  const expenses = money.expenses
  const profit = income - expenses
  return {
    job_id: job.id,
    job_number: formatJobNumber(job.jobnr),
    title: job.title,
    customer_id: job.customer_id ?? null,
    customer_name: customerNameFromJoin(job.customer),
    start_at: job.start_at ?? null,
    end_at: job.end_at ?? null,
    income,
    expenses,
    profit,
    margin_pct: marginPct(income, profit),
  }
}

/**
 * Shared fetch used by job + customer profitability queries.
 */
export async function fetchJobProfitabilityRows({
  companyId,
  fromDate,
  toDate,
}: {
  companyId: string
  fromDate: string
  toDate: string
}): Promise<Array<JobProfitabilityRow>> {
  const overlapping = await fetchOverlappingJobs({
    companyId,
    fromDate,
    toDate,
  })
  if (overlapping.length === 0) return []

  const jobIds = overlapping.map((j) => j.id)
  const byJob = await fetchMoneyTotalsByJob(jobIds)

  return overlapping.map((job) =>
    toJobProfitabilityRow(job, byJob.get(job.id) ?? { income: 0, expenses: 0 }),
  )
}

export function reportJobProfitabilityQuery({
  companyId,
  fromDate,
  toDate,
}: {
  companyId: string
  fromDate: string
  toDate: string
}) {
  return queryOptions<Array<JobProfitabilityRow>>({
    queryKey: ['reporting', 'job-profitability', companyId, fromDate, toDate],
    queryFn: () => fetchJobProfitabilityRows({ companyId, fromDate, toDate }),
  })
}

export function reportCustomerProfitabilityQuery({
  companyId,
  fromDate,
  toDate,
}: {
  companyId: string
  fromDate: string
  toDate: string
}) {
  return queryOptions<Array<CustomerProfitabilityRow>>({
    queryKey: [
      'reporting',
      'customer-profitability',
      companyId,
      fromDate,
      toDate,
    ],
    queryFn: async (): Promise<Array<CustomerProfitabilityRow>> => {
      const jobRows = await fetchJobProfitabilityRows({
        companyId,
        fromDate,
        toDate,
      })

      const byCustomer = new Map<
        string,
        {
          customer_name: string | null
          income: number
          expenses: number
          job_count: number
        }
      >()
      const noCustomerKey = '__no_customer__'
      for (const row of jobRows) {
        const key = row.customer_id ?? noCustomerKey
        const cur = byCustomer.get(key)
        if (!cur) {
          byCustomer.set(key, {
            customer_name: row.customer_name,
            income: row.income,
            expenses: row.expenses,
            job_count: 1,
          })
        } else {
          cur.income += row.income
          cur.expenses += row.expenses
          cur.job_count += 1
        }
      }

      return Array.from(byCustomer.entries())
        .map(([customer_id, cur]) => {
          const profit = cur.income - cur.expenses
          return {
            customer_id: customer_id === noCustomerKey ? null : customer_id,
            customer_name: cur.customer_name,
            income: cur.income,
            expenses: cur.expenses,
            profit,
            margin_pct: marginPct(cur.income, profit),
            job_count: cur.job_count,
          }
        })
        .sort((a, b) => b.profit - a.profit)
    },
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
    queryFn: async (): Promise<Array<UtilizationRow>> => {
      const { fromISO, toISO, from, to } = rangeBounds(fromDate, toDate)
      const rangeStartMs = from.getTime()
      const rangeEndMs = to.getTime()
      const capacity = assumedCapacityHours(fromDate, toDate)

      const { data: periods, error: periodsError } = await supabase
        .from('time_periods')
        .select('id, start_at, end_at')
        .eq('company_id', companyId)
        .eq('deleted', false)
        .lte('start_at', toISO)
        .gte('end_at', fromISO)

      if (periodsError) throw periodsError
      if (!periods?.length) return []

      const periodIds = periods.map((p) => p.id)
      const periodMap = new Map(periods.map((p) => [p.id, p]))

      const { data: crew, error: crewError } = await supabase
        .from('reserved_crew')
        .select('user_id, time_period_id, status')
        .in('time_period_id', periodIds)
        .not('user_id', 'is', null)
        .neq('status', 'canceled')

      if (crewError) throw crewError
      if (!crew?.length) return []

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

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name')
        .in('user_id', userIds)

      const nameByUser = new Map<string, string | null>()
      for (const p of profiles ?? []) {
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
}: {
  companyId: string
  fromDate: string
  toDate: string
}) {
  return queryOptions<Array<MonthlyTrendRow>>({
    queryKey: ['reporting', 'monthly-trend', companyId, fromDate, toDate],
    queryFn: async (): Promise<Array<MonthlyTrendRow>> => {
      const { fromISO, toISO } = rangeBounds(fromDate, toDate)

      const [datedRes, undatedRes] = await Promise.all([
        supabase
          .from('job_money_items')
          .select('type, amount, date, created_at')
          .eq('company_id', companyId)
          .not('date', 'is', null)
          .gte('date', fromISO)
          .lte('date', toISO),
        supabase
          .from('job_money_items')
          .select('type, amount, date, created_at')
          .eq('company_id', companyId)
          .is('date', null)
          .gte('created_at', fromISO)
          .lte('created_at', toISO),
      ])

      if (datedRes.error) throw datedRes.error
      if (undatedRes.error) throw undatedRes.error

      const items = [...(datedRes.data ?? []), ...(undatedRes.data ?? [])]
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
}: {
  companyId: string
  fromDate: string
  toDate: string
}) {
  return queryOptions<InvoicePipelineResult>({
    queryKey: ['reporting', 'invoice-pipeline', companyId, fromDate, toDate],
    queryFn: async (): Promise<InvoicePipelineResult> => {
      const overlapping = await fetchOverlappingJobs({
        companyId,
        fromDate,
        toDate,
        includeStatus: true,
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
