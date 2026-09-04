import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button, Card, Flex, Table, Text } from '@radix-ui/themes'
import ReportTableSkeleton from '@shared/ui/components/ReportTableSkeleton'
import { formatCurrency, formatDate } from '../utils/format'
import { compareValues, toggleSort } from '../utils/sort'
import { SortableHeader } from './SortableHeader'
import type {
  InvoicePipelineBucket,
  InvoicePipelineJobRow,
  InvoicePipelineSummary,
  SortDir,
} from '../types'

const BUCKET_ORDER: Array<InvoicePipelineBucket> = [
  'active',
  'ready',
  'invoiced',
  'paid',
  'canceled',
]

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
  const [sortKey, setSortKey] = React.useState<string | null>('income')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const filtered = React.useMemo(
    () => jobs.filter((j) => j.bucket === bucket),
    [jobs, bucket],
  )

  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) =>
      compareValues(
        a[sortKey as keyof InvoicePipelineJobRow],
        b[sortKey as keyof InvoicePipelineJobRow],
        sortDir,
      ),
    )
  }, [filtered, sortKey, sortDir])

  const onSort = (key: string) => {
    const next = toggleSort(sortKey, sortDir, key)
    setSortKey(next.key)
    setSortDir(next.dir)
  }

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

      <Card size="3">
        {loading ? (
          <ReportTableSkeleton columnCount={6} />
        ) : sorted.length === 0 ? (
          <Text color="gray">No jobs in this status bucket.</Text>
        ) : (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <SortableHeader
                  label="Job #"
                  sortKey="job_number"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Dates</Table.ColumnHeaderCell>
                <SortableHeader
                  label="Income"
                  sortKey="income"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  align="right"
                />
                <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sorted.map((row) => (
                <Table.Row key={row.job_id}>
                  <Table.Cell>#{row.job_number}</Table.Cell>
                  <Table.Cell>{row.title}</Table.Cell>
                  <Table.Cell>{row.customer_name ?? '—'}</Table.Cell>
                  <Table.Cell>
                    {formatDate(row.start_at)} – {formatDate(row.end_at)}
                  </Table.Cell>
                  <Table.Cell align="right">
                    {formatCurrency(row.income)}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() =>
                        navigate({
                          to: '/jobs',
                          search: {
                            jobId: row.job_id,
                            recurringJobId: undefined,
                            tab: undefined,
                          },
                        })
                      }
                    >
                      Open
                    </Button>
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
