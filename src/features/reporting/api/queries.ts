// src/features/reporting/api/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export type JobProfitabilityRow = {
  job_id: string
  job_number: string
  title: string
  customer_id: string | null
  customer_name: string | null
  start_at: string | null
  end_at: string | null
  income: number
  expenses: number
  profit: number
  margin_pct: number | null
}

export type CustomerProfitabilityRow = {
  customer_id: string | null
  customer_name: string | null
  income: number
  expenses: number
  profit: number
  margin_pct: number | null
  job_count: number
}

export type UtilizationRow = {
  user_id: string
  display_name: string | null
  booked_hours: number
}

/**
 * Job profitability: jobs in date range with aggregated income/expense from job_money_items.
 */
export function reportJobProfitabilityQuery({
  companyId,
  fromDate,
  toDate,
}: {
  companyId: string
  fromDate: string
  toDate: string
}) {
  return queryOptions<JobProfitabilityRow[]>({
    queryKey: ['reporting', 'job-profitability', companyId, fromDate, toDate],
    queryFn: async (): Promise<JobProfitabilityRow[]> => {
      const from = new Date(fromDate)
      const to = new Date(toDate)
      const fromISO = from.toISOString()
      const toEnd = new Date(to)
      toEnd.setHours(23, 59, 59, 999)
      const toEndISO = toEnd.toISOString()

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select(
          'id, jobnr, title, start_at, end_at, customer_id, customer:customers(name)',
        )
        .eq('company_id', companyId)

      if (jobsError) throw jobsError
      if (!jobs?.length) return []

      const overlapping = jobs.filter((job: any) => {
        const start = job.start_at ? new Date(job.start_at).getTime() : null
        const end = job.end_at ? new Date(job.end_at).getTime() : null
        const rangeStart = from.getTime()
        const rangeEnd = toEnd.getTime()
        if (start == null && end == null) return true
        if (start != null && end != null) {
          return start <= rangeEnd && end >= rangeStart
        }
        if (start != null) return start <= rangeEnd
        return end != null && end >= rangeStart
      })
      if (overlapping.length === 0) return []

      const jobIds = overlapping.map((j: { id: string }) => j.id)

      const { data: items, error: itemsError } = await supabase
        .from('job_money_items')
        .select('job_id, type, amount')
        .in('job_id', jobIds)

      if (itemsError) throw itemsError

      const byJob = new Map<
        string,
        { income: number; expenses: number }
      >()
      for (const j of jobIds) {
        byJob.set(j, { income: 0, expenses: 0 })
      }
      for (const row of items ?? []) {
        const cur = byJob.get(row.job_id)
        if (!cur) continue
        if (row.type === 'income') cur.income += Number(row.amount)
        else cur.expenses += Number(row.amount)
      }

      return overlapping.map((job: any) => {
        const cur = byJob.get(job.id) ?? { income: 0, expenses: 0 }
        const income = cur.income
        const expenses = cur.expenses
        const profit = income - expenses
        const margin_pct =
          income > 0 ? Math.round((profit / income) * 10000) / 100 : null
        const jobNumber = job.jobnr != null ? String(job.jobnr).padStart(6, '0') : '—'
        const customerName =
          job.customer != null && typeof job.customer === 'object' && job.customer.name != null
            ? job.customer.name
            : null
        return {
          job_id: job.id,
          job_number: jobNumber,
          title: job.title,
          customer_id: job.customer_id ?? null,
          customer_name: customerName,
          start_at: job.start_at ?? null,
          end_at: job.end_at ?? null,
          income,
          expenses,
          profit,
          margin_pct,
        }
      })
    },
  })
}

/**
 * Customer profitability: aggregate job profitability by customer.
 */
export function reportCustomerProfitabilityQuery({
  companyId,
  fromDate,
  toDate,
}: {
  companyId: string
  fromDate: string
  toDate: string
}) {
  return queryOptions<CustomerProfitabilityRow[]>({
    queryKey: [
      'reporting',
      'customer-profitability',
      companyId,
      fromDate,
      toDate,
    ],
    queryFn: async (): Promise<CustomerProfitabilityRow[]> => {
      const jobRows = await reportJobProfitabilityQuery({
        companyId,
        fromDate,
        toDate,
      }).queryFn!({} as any)

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

      return Array.from(byCustomer.entries()).map(([customer_id, cur]) => {
        const profit = cur.income - cur.expenses
        const margin_pct =
          cur.income > 0
            ? Math.round((profit / cur.income) * 10000) / 100
            : null
        return {
          customer_id: customer_id === noCustomerKey ? null : customer_id,
          customer_name: cur.customer_name,
          income: cur.income,
          expenses: cur.expenses,
          profit,
          margin_pct,
          job_count: cur.job_count,
        }
      })
    },
  })
}

/**
 * Utilization: booked hours per user from reserved_crew + time_periods in date range.
 */
export function reportUtilizationQuery({
  companyId,
  fromDate,
  toDate,
}: {
  companyId: string
  fromDate: string
  toDate: string
}) {
  return queryOptions<UtilizationRow[]>({
    queryKey: ['reporting', 'utilization', companyId, fromDate, toDate],
    queryFn: async (): Promise<UtilizationRow[]> => {
      const from = new Date(fromDate)
      const to = new Date(toDate)
      const fromISO = from.toISOString()
      const toISO = to.toISOString()

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
        .select('user_id, time_period_id')
        .in('time_period_id', periodIds)
        .not('user_id', 'is', null)

      if (crewError) throw crewError
      if (!crew?.length) return []

      const hoursByUser = new Map<string, number>()
      for (const row of crew) {
        const uid = row.user_id as string
        const period = periodMap.get(row.time_period_id)
        if (!period?.start_at || !period?.end_at) continue
        const start = new Date(period.start_at).getTime()
        const end = new Date(period.end_at).getTime()
        const hours = (end - start) / (1000 * 60 * 60)
        hoursByUser.set(uid, (hoursByUser.get(uid) ?? 0) + hours)
      }

      const userIds = Array.from(hoursByUser.keys())
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

      return userIds.map((user_id) => ({
        user_id,
        display_name: nameByUser.get(user_id) ?? null,
        booked_hours: Math.round((hoursByUser.get(user_id) ?? 0) * 100) / 100,
      }))
    },
  })
}
