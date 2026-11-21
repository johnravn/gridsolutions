import { marginPct } from './format'
import type { CustomerProfitabilityRow, JobProfitabilityRow } from '../types'

/**
 * Aggregate verified job profitability into customer rows (Reporting charts/KPIs).
 * Unverified jobs stay out of customer totals — same rule as the customers query.
 */
export function aggregateCustomerProfitabilityFromJobs(
  jobRows: Array<JobProfitabilityRow>,
): Array<CustomerProfitabilityRow> {
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
    if (!row.money_verified) continue
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
}
