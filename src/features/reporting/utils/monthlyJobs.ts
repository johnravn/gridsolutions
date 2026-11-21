import { monthKeyFromDate, monthLabelFromKey } from './dates'
import type { JobProfitabilityRow } from '../types'

export type MonthlyJobProfitabilityPoint = {
  month_key: string
  month_label: string
  income: number
  expenses: number
  profit: number
  job_count: number
}

/** Inclusive list of `YYYY-MM` keys from fromDate through toDate. */
export function enumerateMonthKeys(
  fromDate: string,
  toDate: string,
): Array<string> {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return []

  const keys: Array<string> = []
  const cur = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cur <= end) {
    keys.push(monthKeyFromDate(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return keys
}

/**
 * Bucket a job into a calendar month for the monthly profitability chart.
 * Prefer start_at, else end_at. Clip into [fromDate, toDate] so overlapping
 * jobs that started before the range still land on the chart.
 */
export function jobMonthKeyInRange(
  row: Pick<JobProfitabilityRow, 'start_at' | 'end_at'>,
  fromDate: string,
  toDate: string,
): string | null {
  const raw = row.start_at ?? row.end_at
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null

  const keys = enumerateMonthKeys(fromDate, toDate)
  if (keys.length === 0) return null

  const key = monthKeyFromDate(d)
  const first = keys[0]
  const last = keys[keys.length - 1]
  if (key < first) return first
  if (key > last) return last
  return key
}

/**
 * Aggregate job profitability rows into one point per month in the range.
 * Empty months are included with zeros so the X-axis stays continuous.
 */
export function aggregateJobsByMonth(
  rows: Array<JobProfitabilityRow>,
  fromDate: string,
  toDate: string,
): Array<MonthlyJobProfitabilityPoint> {
  const keys = enumerateMonthKeys(fromDate, toDate)
  const buckets = new Map<
    string,
    { income: number; expenses: number; profit: number; job_count: number }
  >()
  for (const key of keys) {
    buckets.set(key, { income: 0, expenses: 0, profit: 0, job_count: 0 })
  }

  for (const row of rows) {
    const key = jobMonthKeyInRange(row, fromDate, toDate)
    if (!key || !buckets.has(key)) continue
    const cur = buckets.get(key)!
    cur.income += row.income
    cur.expenses += row.expenses
    cur.profit += row.profit
    cur.job_count += 1
  }

  return keys.map((month_key) => {
    const cur = buckets.get(month_key)!
    return {
      month_key,
      month_label: monthLabelFromKey(month_key),
      income: cur.income,
      expenses: cur.expenses,
      profit: cur.profit,
      job_count: cur.job_count,
    }
  })
}
