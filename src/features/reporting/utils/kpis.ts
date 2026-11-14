import { formatCurrency, formatPercent, marginPct } from '../utils/format'
import type { KpiItem } from '../components/SummaryKpis'

export function financialKpis(
  rows: Array<{ income: number; expenses: number; profit: number }>,
  options?: { incompleteCount?: number },
): Array<KpiItem> {
  const income = rows.reduce((s, r) => s + r.income, 0)
  const expenses = rows.reduce((s, r) => s + r.expenses, 0)
  const profit = income - expenses
  const items: Array<KpiItem> = [
    { label: 'Income', value: formatCurrency(income), hint: 'Ex MVA' },
    { label: 'Expenses', value: formatCurrency(expenses), hint: 'Ex MVA' },
    { label: 'Profit', value: formatCurrency(profit) },
    {
      label: 'Margin',
      value: formatPercent(marginPct(income, profit)),
    },
  ]
  if (options?.incompleteCount != null && options.incompleteCount > 0) {
    items.push({
      label: 'Incomplete Money',
      value: String(options.incompleteCount),
      hint: 'Completed/paid with no confirmed income',
    })
  }
  return items
}
