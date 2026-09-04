import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button, Card, Table, Text } from '@radix-ui/themes'
import ReportTableSkeleton from '@shared/ui/components/ReportTableSkeleton'
import { formatCurrency, formatDate, formatPercent } from '../utils/format'
import { compareValues, toggleSort } from '../utils/sort'
import { SortableHeader } from './SortableHeader'
import type { JobProfitabilityRow, SortDir } from '../types'

export function JobProfitabilityTable({
  rows,
  loading,
}: {
  rows: Array<JobProfitabilityRow>
  loading: boolean
}) {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = React.useState<string | null>('profit')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) =>
      compareValues(
        a[sortKey as keyof JobProfitabilityRow],
        b[sortKey as keyof JobProfitabilityRow],
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
    <Card size="3">
      {loading ? (
        <ReportTableSkeleton columnCount={9} />
      ) : rows.length === 0 ? (
        <Text color="gray">No jobs in this period.</Text>
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
              <SortableHeader
                label="Margin %"
                sortKey="margin_pct"
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
                <Table.Cell align="right">
                  {formatCurrency(row.expenses)}
                </Table.Cell>
                <Table.Cell align="right">
                  {formatCurrency(row.profit)}
                </Table.Cell>
                <Table.Cell align="right">
                  {formatPercent(row.margin_pct)}
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
  )
}
