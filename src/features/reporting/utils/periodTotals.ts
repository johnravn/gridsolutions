import { syncZeroAlignedDomains } from './syncZeroAlignedDomains'

export type PeriodTotals = {
  expenses: number
  income: number
  profit: number
  job_count: number
}

/** Sum verified job rows into period totals (job_count = row count). */
export function aggregatePeriodTotals(
  rows: Array<{ income: number; expenses: number; profit: number }>,
): PeriodTotals {
  const income = rows.reduce((s, r) => s + r.income, 0)
  const expenses = rows.reduce((s, r) => s + r.expenses, 0)
  return {
    income,
    expenses,
    profit: income - expenses,
    job_count: rows.length,
  }
}

/**
 * Dual Y domains for the period totals bar chart. Money (Expenses / Income /
 * Profit) and Jobs (count) must not share one scale — that would either crush
 * the Jobs bar or imply a job count is kroner. Zeros stay plot-aligned via
 * syncZeroAlignedDomains (same approach as the monthly chart).
 */
export function periodTotalsChartDomains(totals: PeriodTotals): {
  money: [number, number]
  jobs: [number, number]
} {
  const moneyMin = Math.min(0, totals.income, totals.expenses, totals.profit)
  const moneyMax = Math.max(0, totals.income, totals.expenses, totals.profit)
  const { a: money, b: jobs } = syncZeroAlignedDomains(
    moneyMin,
    moneyMax,
    0,
    Math.max(totals.job_count, 1),
  )
  return { money, jobs }
}
