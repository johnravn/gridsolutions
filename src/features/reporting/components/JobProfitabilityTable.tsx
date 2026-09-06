import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button, Text } from '@radix-ui/themes'
import {
  VirtualIndexTable,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { formatCurrency, formatDate, formatPercent } from '../utils/format'
import { compareValues } from '../utils/sort'
import { ReportTableShell } from './ReportTableShell'
import type { IndexColumn } from '@shared/ui/index-table'
import type { JobProfitabilityRow } from '../types'

type SortKey =
  | 'job_number'
  | 'title'
  | 'customer_name'
  | 'income'
  | 'expenses'
  | 'profit'
  | 'margin_pct'

const COLUMNS: Array<IndexColumn<SortKey>> = [
  { id: 'job_number', header: 'Job #', sortable: true },
  { id: 'title', header: 'Title', sortable: true },
  { id: 'customer_name', header: 'Customer', sortable: true },
  { id: 'dates', header: 'Dates' },
  { id: 'income', header: 'Income', sortable: true, align: 'end' },
  { id: 'expenses', header: 'Expenses', sortable: true, align: 'end' },
  { id: 'profit', header: 'Profit', sortable: true, align: 'end' },
  { id: 'margin_pct', header: 'Margin %', sortable: true, align: 'end' },
]

const GRID =
  'minmax(72px, 0.7fr) minmax(120px, 1.4fr) minmax(100px, 1.2fr) minmax(120px, 1.2fr) minmax(80px, 0.9fr) minmax(80px, 0.9fr) minmax(80px, 0.9fr) minmax(72px, 0.8fr)'

export function JobProfitabilityTable({
  rows,
  loading,
}: {
  rows: Array<JobProfitabilityRow>
  loading: boolean
}) {
  const navigate = useNavigate()
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
    getRowId: (r) => r.job_id,
    estimateRowSize: 44,
  })

  return (
    <ReportTableShell>
      <VirtualIndexTable
        rows={sorted}
        columns={COLUMNS}
        gridTemplateColumns={GRID}
        getRowId={(r) => r.job_id}
        selectable={false}
        renderCell={(row, colId) => {
          switch (colId) {
            case 'job_number':
              return <Text size="2">#{row.job_number}</Text>
            case 'title':
              return (
                <Text size="2" truncate>
                  {row.title}
                </Text>
              )
            case 'customer_name':
              return (
                <Text size="2" truncate>
                  {row.customer_name ?? '—'}
                </Text>
              )
            case 'dates':
              return (
                <Text size="2" color="gray">
                  {formatDate(row.start_at)} – {formatDate(row.end_at)}
                </Text>
              )
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
        renderRowActions={(row) => (
          <Button
            size="1"
            variant="soft"
            onClick={(e) => {
              e.stopPropagation()
              navigate({
                to: '/jobs',
                search: {
                  jobId: row.job_id,
                  recurringJobId: undefined,
                  tab: undefined,
                },
              })
            }}
          >
            Open
          </Button>
        )}
        actionsColumnWidth="72px"
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        scrollRef={scrollRef}
        rowVirtualizer={rowVirtualizer}
        isLoading={loading}
        emptyMessage="No jobs in this period."
        footerCount={sorted.length}
        horizontalScroll
      />
    </ReportTableShell>
  )
}
