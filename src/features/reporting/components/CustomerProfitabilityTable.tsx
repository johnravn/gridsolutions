import * as React from 'react'
import { Text } from '@radix-ui/themes'
import {
  VirtualIndexTable,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { formatCurrency, formatPercent } from '../utils/format'
import { compareValues } from '../utils/sort'
import { ReportTableShell } from './ReportTableShell'
import type { IndexColumn } from '@shared/ui/index-table'
import type { CustomerProfitabilityRow } from '../types'

type SortKey =
  | 'customer_name'
  | 'job_count'
  | 'income'
  | 'expenses'
  | 'profit'
  | 'margin_pct'

const COLUMNS: Array<IndexColumn<SortKey>> = [
  { id: 'customer_name', header: 'Customer', sortable: true },
  { id: 'job_count', header: 'Jobs', sortable: true },
  { id: 'income', header: 'Income', sortable: true, align: 'end' },
  { id: 'expenses', header: 'Expenses', sortable: true, align: 'end' },
  { id: 'profit', header: 'Profit', sortable: true, align: 'end' },
  { id: 'margin_pct', header: 'Margin %', sortable: true, align: 'end' },
]

const GRID =
  'minmax(140px, 2fr) minmax(60px, 0.6fr) minmax(90px, 1fr) minmax(90px, 1fr) minmax(90px, 1fr) minmax(80px, 0.8fr)'

export function CustomerProfitabilityTable({
  rows,
  loading,
}: {
  rows: Array<CustomerProfitabilityRow>
  loading: boolean
}) {
  const { sortBy, sortDir, handleSort } = useClientSort<SortKey>(
    'profit',
    'desc',
  )

  const sorted = React.useMemo(() => {
    return [...rows].sort((a, b) =>
      compareValues(a[sortBy], b[sortBy], sortDir),
    )
  }, [rows, sortBy, sortDir])

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows: sorted,
    getRowId: (r) => r.customer_id ?? '__no_customer__',
    estimateRowSize: 44,
  })

  return (
    <ReportTableShell>
      <VirtualIndexTable
        rows={sorted}
        columns={COLUMNS}
        gridTemplateColumns={GRID}
        getRowId={(r) => r.customer_id ?? '__no_customer__'}
        selectable={false}
        renderCell={(row, colId) => {
          switch (colId) {
            case 'customer_name':
              return (
                <Text size="2" truncate>
                  {row.customer_name ?? '—'}
                </Text>
              )
            case 'job_count':
              return <Text size="2">{row.job_count}</Text>
            case 'income':
              return <Text size="2">{formatCurrency(row.income)}</Text>
            case 'expenses':
              return <Text size="2">{formatCurrency(row.expenses)}</Text>
            case 'profit':
              return <Text size="2">{formatCurrency(row.profit)}</Text>
            case 'margin_pct':
              return <Text size="2">{formatPercent(row.margin_pct)}</Text>
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
        emptyMessage="No customer data in this period."
        footerCount={sorted.length}
        horizontalScroll
      />
    </ReportTableShell>
  )
}
