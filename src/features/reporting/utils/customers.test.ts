import { describe, expect, it } from 'vitest'
import { aggregateCustomerProfitabilityFromJobs } from './customers'
import type { JobProfitabilityRow } from '../types'

function job(
  partial: Partial<JobProfitabilityRow> &
    Pick<JobProfitabilityRow, 'job_id' | 'customer_id' | 'income' | 'expenses'>,
): JobProfitabilityRow {
  const income = partial.income
  const expenses = partial.expenses
  const profit = income - expenses
  return {
    job_number: '1',
    title: 'Job',
    customer_name: partial.customer_name ?? 'Acme',
    project_lead_user_id: null,
    project_lead_name: 'Lead',
    project_lead_avatar_url: null,
    start_at: null,
    end_at: null,
    status: 'invoiced',
    profit,
    margin_pct: null,
    money_item_count: 1,
    money_incomplete: false,
    money_verified: true,
    money_verified_at: '2026-11-21T12:00:00Z',
    ...partial,
    ...(partial.money_verified === false &&
    partial.money_verified_at === undefined
      ? { money_verified_at: null }
      : {}),
  }
}

describe('aggregateCustomerProfitabilityFromJobs', () => {
  it('sums verified jobs per customer and skips unverified', () => {
    const rows = aggregateCustomerProfitabilityFromJobs([
      job({
        job_id: '1',
        customer_id: 'c1',
        customer_name: 'Acme',
        income: 1000,
        expenses: 200,
      }),
      job({
        job_id: '2',
        customer_id: 'c1',
        customer_name: 'Acme',
        income: 500,
        expenses: 100,
      }),
      job({
        job_id: '3',
        customer_id: 'c2',
        customer_name: 'Beta',
        income: 800,
        expenses: 50,
        money_verified: false,
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      customer_id: 'c1',
      income: 1500,
      expenses: 300,
      profit: 1200,
      job_count: 2,
    })
  })
})
