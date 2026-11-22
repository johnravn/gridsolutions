import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, Badge, Button, Flex, Text, Tooltip } from '@radix-ui/themes'
import {
  VirtualIndexTable,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { getInitials } from '@shared/lib/generalFunctions'
import { resolveAvatarUrl } from '@shared/lib/avatarUrl'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
} from '../utils/format'
import { compareValues } from '../utils/sort'
import { ReportTableShell } from './ReportTableShell'
import type { IndexColumn } from '@shared/ui/index-table'
import type { JobProfitabilityRow } from '../types'

type SortKey =
  | 'job_number'
  | 'title'
  | 'customer_name'
  | 'project_lead_name'
  | 'money_verified'
  | 'income'
  | 'expenses'
  | 'profit'
  | 'margin_pct'

const COLUMNS: Array<IndexColumn<SortKey>> = [
  { id: 'job_number', header: 'Job #', sortable: true },
  { id: 'title', header: 'Title', sortable: true },
  { id: 'customer_name', header: 'Customer', sortable: true },
  { id: 'project_lead_name', header: 'Lead', sortable: true },
  { id: 'money_verified', header: 'Verified', sortable: true },
  { id: 'dates', header: 'Dates' },
  { id: 'income', header: 'Income', sortable: true, align: 'end' },
  { id: 'expenses', header: 'Expenses', sortable: true, align: 'end' },
  { id: 'profit', header: 'Profit', sortable: true, align: 'end' },
  { id: 'margin_pct', header: 'Margin %', sortable: true, align: 'end' },
]

const GRID =
  'minmax(72px, 0.7fr) minmax(140px, 1.5fr) minmax(100px, 1.1fr) minmax(100px, 1fr) minmax(88px, 0.8fr) minmax(120px, 1.1fr) minmax(80px, 0.85fr) minmax(80px, 0.85fr) minmax(80px, 0.85fr) minmax(72px, 0.75fr)'

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
                <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                  <Text size="2" truncate style={{ minWidth: 0 }}>
                    {row.title}
                  </Text>
                  {row.money_incomplete ? (
                    <Badge size="1" color="orange" variant="soft">
                      Incomplete
                    </Badge>
                  ) : null}
                </Flex>
              )
            case 'customer_name':
              return (
                <Text size="2" truncate>
                  {row.customer_name ?? '—'}
                </Text>
              )
            case 'project_lead_name': {
              const unassigned = row.project_lead_name === 'Unassigned'
              const avatarUrl = resolveAvatarUrl(row.project_lead_avatar_url)
              const initials = getInitials(
                unassigned ? '' : row.project_lead_name,
              )
              return (
                <Flex
                  align="center"
                  gap="2"
                  style={{ minWidth: 0 }}
                  title={row.project_lead_name}
                >
                  <Avatar
                    size="1"
                    src={avatarUrl ?? undefined}
                    fallback={unassigned ? '?' : initials}
                    radius="full"
                    style={{ flexShrink: 0 }}
                  />
                  <Text
                    size="2"
                    truncate
                    style={{ minWidth: 0 }}
                    color={unassigned ? 'gray' : undefined}
                  >
                    {row.project_lead_name}
                  </Text>
                </Flex>
              )
            }
            case 'money_verified':
              return row.money_verified ? (
                <Tooltip
                  content={`Verified ${formatDateTime(row.money_verified_at)}`}
                >
                  <Badge size="1" color="green" variant="soft">
                    Verified
                  </Badge>
                </Tooltip>
              ) : (
                <Text size="2" color="gray">
                  —
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
                  tab: 'money',
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
