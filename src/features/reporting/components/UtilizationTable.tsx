import * as React from 'react'
import { Card, Table, Text } from '@radix-ui/themes'
import ReportTableSkeleton from '@shared/ui/components/ReportTableSkeleton'
import { formatHours, formatPercent } from '../utils/format'
import { compareValues, toggleSort } from '../utils/sort'
import { SortableHeader } from './SortableHeader'
import type { SortDir, UtilizationRow } from '../types'

export function UtilizationTable({
  rows,
  loading,
}: {
  rows: Array<UtilizationRow>
  loading: boolean
}) {
  const [sortKey, setSortKey] = React.useState<string | null>('booked_hours')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) =>
      compareValues(
        a[sortKey as keyof UtilizationRow],
        b[sortKey as keyof UtilizationRow],
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
        <ReportTableSkeleton columnCount={4} rowCount={6} />
      ) : rows.length === 0 ? (
        <Text color="gray">No crew bookings in this period.</Text>
      ) : (
        <>
          <Text size="1" color="gray" mb="2" as="div">
            Assumes {rows[0]?.capacity_hours ?? 0} h capacity (7.5 h × weekdays
            in range).
          </Text>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <SortableHeader
                  label="Person"
                  sortKey="display_name"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableHeader
                  label="Booked hours"
                  sortKey="booked_hours"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  align="right"
                />
                <SortableHeader
                  label="Capacity"
                  sortKey="capacity_hours"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  align="right"
                />
                <SortableHeader
                  label="Utilization %"
                  sortKey="utilization_pct"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  align="right"
                />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sorted.map((row) => (
                <Table.Row key={row.user_id}>
                  <Table.Cell>{row.display_name ?? row.user_id}</Table.Cell>
                  <Table.Cell align="right">
                    {formatHours(row.booked_hours)}
                  </Table.Cell>
                  <Table.Cell align="right">
                    {formatHours(row.capacity_hours)}
                  </Table.Cell>
                  <Table.Cell align="right">
                    {formatPercent(row.utilization_pct)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </>
      )}
    </Card>
  )
}
