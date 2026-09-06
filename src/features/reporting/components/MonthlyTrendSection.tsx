import * as React from 'react'
import { Card, Text } from '@radix-ui/themes'
import {
  ChartTypeSelector,
  IncomeExpensesChart,
} from '@shared/ui/components/IncomeExpensesChart'
import ChartSkeleton from '@shared/ui/components/ChartSkeleton'
import {
  VirtualIndexTable,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { formatCurrency } from '../utils/format'
import { compareValues } from '../utils/sort'
import { ReportTableShell } from './ReportTableShell'
import type { IndexColumn } from '@shared/ui/index-table'
import type { MonthlyTrendRow } from '../types'

type SortKey = 'month_key' | 'income' | 'expenses' | 'profit'

const COLUMNS: Array<IndexColumn<SortKey>> = [
  { id: 'month_key', header: 'Month', sortable: true },
  { id: 'income', header: 'Income', sortable: true, align: 'end' },
  { id: 'expenses', header: 'Expenses', sortable: true, align: 'end' },
  { id: 'profit', header: 'Profit', sortable: true, align: 'end' },
]

const GRID =
  'minmax(120px, 1.5fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr)'

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
  const { sortBy, sortDir, handleSort } = useClientSort<SortKey>(
    'month_key',
    'asc',
  )

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
    return [...rows].sort((a, b) =>
      compareValues(a[sortBy], b[sortBy], sortDir),
    )
  }, [rows, sortBy, sortDir])

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows: sorted,
    getRowId: (r) => r.month_key,
    estimateRowSize: 44,
  })

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

      <ReportTableShell>
        <VirtualIndexTable
          rows={sorted}
          columns={COLUMNS}
          gridTemplateColumns={GRID}
          getRowId={(r) => r.month_key}
          selectable={false}
          renderCell={(row, colId) => {
            switch (colId) {
              case 'month_key':
                return <Text size="2">{row.month_label}</Text>
              case 'income':
                return <Text size="2">{formatCurrency(row.income)}</Text>
              case 'expenses':
                return <Text size="2">{formatCurrency(row.expenses)}</Text>
              case 'profit':
                return <Text size="2">{formatCurrency(row.profit)}</Text>
              default:
                return null
            }
          }}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          scrollRef={scrollRef}
          rowVirtualizer={rowVirtualizer}
          isLoading={loading}
          emptyMessage="No money items in this period."
          footerCount={sorted.length}
          horizontalScroll={false}
        />
      </ReportTableShell>
    </>
  )
}
