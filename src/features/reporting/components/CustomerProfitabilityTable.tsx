import * as React from 'react'
import { Card, Table, Text } from '@radix-ui/themes'
import ReportTableSkeleton from '@shared/ui/components/ReportTableSkeleton'
import { formatCurrency, formatPercent } from '../utils/format'
import { compareValues, toggleSort } from '../utils/sort'
import { SortableHeader } from './SortableHeader'
import type { CustomerProfitabilityRow, SortDir } from '../types'

export function CustomerProfitabilityTable({
  rows,
  loading,
}: {
  rows: Array<CustomerProfitabilityRow>
  loading: boolean
}) {
  const [sortKey, setSortKey] = React.useState<string | null>('profit')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) =>
      compareValues(
        a[sortKey as keyof CustomerProfitabilityRow],
        b[sortKey as keyof CustomerProfitabilityRow],
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
        <ReportTableSkeleton columnCount={6} />
      ) : rows.length === 0 ? (
        <Text color="gray">No customer data in this period.</Text>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <SortableHeader
                label="Customer"
                sortKey="customer_name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Jobs"
                sortKey="job_count"
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
              <SortableHeader
                label="Margin %"
                sortKey="margin_pct"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sorted.map((row, i) => (
              <Table.Row key={row.customer_id ?? `no-customer-${i}`}>
                <Table.Cell>{row.customer_name ?? '—'}</Table.Cell>
                <Table.Cell>{row.job_count}</Table.Cell>
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
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </Card>
  )
}
