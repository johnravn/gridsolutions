import * as React from 'react'
import { Card, Table, Text } from '@radix-ui/themes'
import {
  ChartTypeSelector,
  IncomeExpensesChart,
} from '@shared/ui/components/IncomeExpensesChart'
import ReportTableSkeleton from '@shared/ui/components/ReportTableSkeleton'
import ChartSkeleton from '@shared/ui/components/ChartSkeleton'
import { formatCurrency } from '../utils/format'
import { compareValues, toggleSort } from '../utils/sort'
import { SortableHeader } from './SortableHeader'
import type { MonthlyTrendRow, SortDir } from '../types'

export function MonthlyTrendSection({
  rows,
  loading,
}: {
  rows: Array<MonthlyTrendRow>
  loading: boolean
}) {
  const [chartType, setChartType] = React.useState<
    'bar' | 'line' | 'area' | 'composed'
  >('area')
  const [sortKey, setSortKey] = React.useState<string | null>('month_key')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const chartData = React.useMemo(
    () =>
      rows.map((r) => ({
        month: r.month_label,
        income: r.income,
        expenses: r.expenses,
        result: r.profit,
      })),
    [rows],
  )

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) =>
      compareValues(
        a[sortKey as keyof MonthlyTrendRow] as string | number | null,
        b[sortKey as keyof MonthlyTrendRow] as string | number | null,
        sortDir,
      ),
    )
  }, [rows, sortKey, sortDir])

  const onSort = (key: string) => {
    const next = toggleSort(sortKey, sortDir, key)
    setSortKey(next.key)
    setSortDir(next.dir)
  }

  return (
    <>
      {loading ? (
        <Card size="3">
          <ChartSkeleton />
        </Card>
      ) : chartData.length > 0 ? (
        <Card size="3">
          <ChartTypeSelector
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
          <IncomeExpensesChart
            data={chartData}
            height={300}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
        </Card>
      ) : null}

      <Card size="3">
        {loading ? (
          <ReportTableSkeleton columnCount={4} />
        ) : rows.length === 0 ? (
          <Text color="gray">No money items in this period.</Text>
        ) : (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <SortableHeader
                  label="Month"
                  sortKey="month_key"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableHeader
                  label="Income"
                  sortKey="income"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  align="right"
                />
                <SortableHeader
                  label="Expenses"
                  sortKey="expenses"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  align="right"
                />
                <SortableHeader
                  label="Profit"
                  sortKey="profit"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  align="right"
                />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sorted.map((row) => (
                <Table.Row key={row.month_key}>
                  <Table.Cell>{row.month_label}</Table.Cell>
                  <Table.Cell align="right">
                    {formatCurrency(row.income)}
                  </Table.Cell>
                  <Table.Cell align="right">
                    {formatCurrency(row.expenses)}
                  </Table.Cell>
                  <Table.Cell align="right">
                    {formatCurrency(row.profit)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </>
  )
}
