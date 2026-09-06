import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button, Card, Flex, Text } from '@radix-ui/themes'
import ReportTableSkeleton from '@shared/ui/components/ReportTableSkeleton'
import {
  VirtualIndexTable,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { formatCurrency, formatDate } from '../utils/format'
import { compareValues } from '../utils/sort'
import { ReportTableShell } from './ReportTableShell'
import type { IndexColumn } from '@shared/ui/index-table'
import type {
  InvoicePipelineBucket,
  InvoicePipelineJobRow,
  InvoicePipelineSummary,
} from '../types'

const BUCKET_ORDER: Array<InvoicePipelineBucket> = [
  'active',
  'ready',
  'invoiced',
  'paid',
  'canceled',
]

type SortKey = 'job_number' | 'title' | 'customer_name' | 'income'

const COLUMNS: Array<IndexColumn<SortKey>> = [
  { id: 'job_number', header: 'Job #', sortable: true },
  { id: 'title', header: 'Title', sortable: true },
  { id: 'customer_name', header: 'Customer', sortable: true },
  { id: 'dates', header: 'Dates' },
  { id: 'income', header: 'Income', sortable: true, align: 'end' },
]

const GRID =
  'minmax(72px, 0.7fr) minmax(140px, 1.6fr) minmax(120px, 1.2fr) minmax(120px, 1.2fr) minmax(90px, 0.9fr)'

export function InvoicePipelineSection({
  summaries,
  jobs,
  loading,
}: {
  summaries: Array<InvoicePipelineSummary>
  jobs: Array<InvoicePipelineJobRow>
  loading: boolean
}) {
  const navigate = useNavigate()
  const [bucket, setBucket] = React.useState<InvoicePipelineBucket>('ready')
  const { sortBy, sortDir, handleSort } = useClientSort<SortKey>(
    'income',
    'desc',
  )

  const filtered = React.useMemo(
    () => jobs.filter((j) => j.bucket === bucket),
    [jobs, bucket],
  )

  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) =>
      compareValues(a[sortBy], b[sortBy], sortDir),
    )
  }, [filtered, sortBy, sortDir])

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows: sorted,
    getRowId: (r) => r.job_id,
    estimateRowSize: 44,
  })

  return (
    <>
      <Flex gap="3" wrap="wrap">
        {loading
          ? BUCKET_ORDER.map((b) => (
              <Card
                key={b}
                size="2"
                style={{ minWidth: 140, flex: '1 1 140px' }}
              >
                <ReportTableSkeleton columnCount={1} rowCount={2} />
              </Card>
            ))
          : summaries.map((s) => {
              const active = s.bucket === bucket
              return (
                <Card
                  key={s.bucket}
                  size="2"
                  style={{
                    minWidth: 140,
                    flex: '1 1 140px',
                    cursor: 'pointer',
                    outline: active ? '2px solid var(--accent-9)' : undefined,
                  }}
                  onClick={() => setBucket(s.bucket)}
                >
                  <Flex direction="column" gap="1">
                    <Text size="1" color="gray">
                      {s.label}
                    </Text>
                    <Text size="5" weight="bold">
                      {s.job_count}
                    </Text>
                    <Text size="1" color="gray">
                      {formatCurrency(s.income)} income
                    </Text>
                  </Flex>
                </Card>
              )
            })}
      </Flex>

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
          emptyMessage="No jobs in this status bucket."
          footerCount={sorted.length}
          horizontalScroll
        />
      </ReportTableShell>
    </>
  )
}
