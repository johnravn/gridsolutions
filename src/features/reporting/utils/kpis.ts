import { formatCurrency, formatPercent, marginPct } from '../utils/format'
import type { KpiItem } from '../components/SummaryKpis'

export function financialKpis(
  rows: Array<{ income: number; expenses: number; profit: number }>,
): Array<KpiItem> {
  const income = rows.reduce((s, r) => s + r.income, 0)
  const expenses = rows.reduce((s, r) => s + r.expenses, 0)
  const profit = income - expenses
  return [
    { label: 'Income', value: formatCurrency(income) },
    { label: 'Expenses', value: formatCurrency(expenses) },
    { label: 'Profit', value: formatCurrency(profit) },
    {
      label: 'Margin',
      value: formatPercent(marginPct(income, profit)),
    },
  ]
}
