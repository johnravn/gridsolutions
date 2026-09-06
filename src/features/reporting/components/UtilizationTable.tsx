import * as React from 'react'
import { Text } from '@radix-ui/themes'
import {
  VirtualIndexTable,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { formatHours, formatPercent } from '../utils/format'
import { compareValues } from '../utils/sort'
import { ReportTableShell } from './ReportTableShell'
import type { IndexColumn } from '@shared/ui/index-table'
import type { UtilizationRow } from '../types'

type SortKey =
  | 'display_name'
  | 'booked_hours'
  | 'capacity_hours'
  | 'utilization_pct'

const COLUMNS: Array<IndexColumn<SortKey>> = [
  { id: 'display_name', header: 'Person', sortable: true },
  { id: 'booked_hours', header: 'Booked hours', sortable: true, align: 'end' },
  { id: 'capacity_hours', header: 'Capacity', sortable: true, align: 'end' },
  {
    id: 'utilization_pct',
    header: 'Utilization %',
    sortable: true,
    align: 'end',
  },
]

const GRID =
  'minmax(140px, 2fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr)'

export function UtilizationTable({
  rows,
  loading,
}: {
  rows: Array<UtilizationRow>
  loading: boolean
}) {
  const { sortBy, sortDir, handleSort } = useClientSort<SortKey>(
    'booked_hours',
    'desc',
  )

  const sorted = React.useMemo(() => {
    return [...rows].sort((a, b) =>
      compareValues(a[sortBy], b[sortBy], sortDir),
    )
  }, [rows, sortBy, sortDir])

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows: sorted,
    getRowId: (r) => r.user_id,
    estimateRowSize: 44,
  })

  return (
    <ReportTableShell
      header={
        rows.length > 0 ? (
          <Text size="1" color="gray">
            Assumes {rows[0]?.capacity_hours ?? 0} h capacity (7.5 h × weekdays
            in range).
          </Text>
        ) : undefined
      }
    >
      <VirtualIndexTable
        rows={sorted}
        columns={COLUMNS}
        gridTemplateColumns={GRID}
        getRowId={(r) => r.user_id}
        selectable={false}
        renderCell={(row, colId) => {
          switch (colId) {
            case 'display_name':
              return (
                <Text size="2" truncate>
                  {row.display_name ?? row.user_id}
                </Text>
              )
            case 'booked_hours':
              return <Text size="2">{formatHours(row.booked_hours)}</Text>
            case 'capacity_hours':
              return <Text size="2">{formatHours(row.capacity_hours)}</Text>
            case 'utilization_pct':
              return <Text size="2">{formatPercent(row.utilization_pct)}</Text>
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
        emptyMessage="No crew bookings in this period."
        footerCount={sorted.length}
        horizontalScroll={false}
      />
    </ReportTableShell>
  )
}
