import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Code,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import {
  IndexTableBodySkeleton,
  VirtualIndexTable,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { INDEX_TABLE_ROW_CLASS } from '@shared/ui/index-table/indexTableStyles'
import { latestFeedQuery } from '@features/latest/api/queries'
import {
  activityEntityLabel,
  formatActivityTitle,
  formatLogTimestamp,
} from '@features/latest/utils/formatActivityTitle'
import { getActivityNavigation } from '@features/latest/utils/activityNavigation'
import { crewIndexQuery } from '../../crew/api/queries'
import CompanyLogsFilters, {
  DEFAULT_LOGS_FILTERS,
  activityTypesForCategory,
  dateRangeFromFilters,
} from './CompanyLogsFilters'
import type { CompanyLogsFilterState } from './CompanyLogsFilters'
import type { IndexColumn } from '@shared/ui/index-table'
import type { ActivityFeedItem } from '@features/latest/types'

const GRID_COLUMNS =
  'minmax(148px, 0.9fr) minmax(100px, 0.7fr) minmax(200px, 2.2fr) minmax(120px, 0.9fr)'

const COLUMNS: Array<IndexColumn> = [
  { id: 'timestamp', header: 'Timestamp' },
  { id: 'entity', header: 'Entity' },
  { id: 'event', header: 'Event' },
  { id: 'actor', header: 'Actor' },
]

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export default function CompanyLogsTab({
  initialActivityId,
}: {
  initialActivityId?: string | null
}) {
  const { companyId } = useCompany()
  const { userId } = useAuthz()
  const navigate = useNavigate()
  const [filters, setFilters] =
    React.useState<CompanyLogsFilterState>(DEFAULT_LOGS_FILTERS)
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialActivityId ?? null,
  )
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  React.useEffect(() => {
    if (initialActivityId) setSelectedId(initialActivityId)
  }, [initialActivityId])

  const { data: employees = [], isLoading: actorsLoading } = useQuery({
    ...(companyId
      ? crewIndexQuery({ companyId, kind: 'all' })
      : {
          queryKey: ['company', 'none', 'crew-index', 'all'] as const,
          queryFn: () => [],
        }),
    enabled: !!companyId,
  })

  const actorsSorted = React.useMemo(() => {
    const list = [...employees]
    list.sort((a, b) => {
      const la =
        a.display_name ||
        [a.first_name, a.last_name].filter(Boolean).join(' ') ||
        a.email
      const lb =
        b.display_name ||
        [b.first_name, b.last_name].filter(Boolean).join(' ') ||
        b.email
      return la.localeCompare(lb)
    })
    return list
  }, [employees])

  const activityTypes = activityTypesForCategory(filters.category)
  const { from, to } = dateRangeFromFilters(filters)
  const actorUserId = filters.actorUserId === 'all' ? null : filters.actorUserId

  const { data, isLoading, isError } = useQuery({
    ...latestFeedQuery({
      companyId: companyId ?? '',
      userId,
      activityTypes,
      actorUserId,
      from,
      to,
      search: debouncedSearch || null,
      limit: 200,
    }),
    enabled: !!companyId,
  })

  const items = data?.items ?? []
  const selected = items.find((item) => item.id === selectedId) ?? null

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows: items,
    getRowId: (row) => row.id,
    estimateRowSize: 36,
    overscan: 12,
  })

  const openEntity = (activity: ActivityFeedItem) => {
    const nav = getActivityNavigation(activity)
    if (!nav?.id) return
    void navigate({
      to: nav.route as never,
      search: { [nav.searchParam]: nav.id } as never,
    })
  }

  return (
    <Card
      size="4"
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        p="4"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Flex direction="column" gap="3" style={{ flex: 1, minHeight: 0 }}>
          <Flex align="baseline" justify="between" gap="3" wrap="wrap">
            <Heading size="5">Logs</Heading>
            <Text size="2" color="gray">
              {data?.total != null
                ? `${items.length} shown · ${data.total} matching`
                : `${items.length} events`}
            </Text>
          </Flex>

          <Text size="2" color="gray">
            Company activity log — filterable by type, actor, date, and text.
          </Text>

          <CompanyLogsFilters
            filters={filters}
            onChange={setFilters}
            actors={actorsSorted}
            actorsLoading={actorsLoading}
          />

          <Separator size="4" />

          <Box
            style={{
              flex: 1,
              minHeight: 280,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--gray-a5)',
              borderRadius: 'var(--radius-2)',
              overflow: 'hidden',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {isLoading ? (
              <Box p="3">
                <IndexTableBodySkeleton rowCount={10} rowHeight={36} />
              </Box>
            ) : isError ? (
              <Box p="4">
                <Text color="red" size="2">
                  Failed to load activity log
                </Text>
              </Box>
            ) : items.length === 0 ? (
              <Box p="4">
                <Text color="gray" size="2">
                  No log entries match these filters
                </Text>
              </Box>
            ) : (
              <VirtualIndexTable
                rows={items}
                columns={COLUMNS}
                gridTemplateColumns={GRID_COLUMNS}
                getRowId={(row) => row.id}
                selectedId={selectedId}
                onSelect={setSelectedId}
                scrollRef={scrollRef}
                rowVirtualizer={rowVirtualizer}
                getRowClassName={() => INDEX_TABLE_ROW_CLASS}
                renderCell={(row, columnId) => {
                  if (columnId === 'timestamp') {
                    return (
                      <Text size="1" style={{ whiteSpace: 'nowrap' }}>
                        {formatLogTimestamp(row.created_at)}
                      </Text>
                    )
                  }
                  if (columnId === 'entity') {
                    return (
                      <Code size="1" variant="ghost" color="gray">
                        {activityEntityLabel(row.activity_type)}
                      </Code>
                    )
                  }
                  if (columnId === 'event') {
                    return (
                      <Text
                        size="1"
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={formatActivityTitle(row)}
                      >
                        {formatActivityTitle(row)}
                      </Text>
                    )
                  }
                  if (columnId === 'actor') {
                    const name =
                      row.created_by.display_name || row.created_by.email
                    return (
                      <Text
                        size="1"
                        color="gray"
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={name}
                      >
                        {name}
                      </Text>
                    )
                  }
                  return null
                }}
              />
            )}
          </Box>

          {selected && (
            <Box
              p="3"
              style={{
                border: '1px solid var(--gray-a5)',
                borderRadius: 'var(--radius-2)',
                background: 'var(--gray-a2)',
                flexShrink: 0,
              }}
            >
              <Flex direction="column" gap="2">
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                    <Text size="2" weight="medium">
                      {formatActivityTitle(selected)}
                    </Text>
                    <Text size="1" color="gray">
                      <Code size="1" variant="ghost">
                        {selected.activity_type}
                      </Code>
                      {' · '}
                      {formatLogTimestamp(selected.created_at)}
                      {' · '}
                      {selected.created_by.display_name ||
                        selected.created_by.email}
                    </Text>
                  </Flex>
                  <Flex gap="2">
                    {getActivityNavigation(selected)?.id && (
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => openEntity(selected)}
                      >
                        Open entity
                      </Button>
                    )}
                    <Button
                      size="1"
                      variant="ghost"
                      onClick={() => setSelectedId(null)}
                    >
                      Clear
                    </Button>
                  </Flex>
                </Flex>
                {selected.description && (
                  <Text size="2" color="gray">
                    {selected.description}
                  </Text>
                )}
                {Object.keys(selected.metadata ?? {}).length > 0 && (
                  <pre
                    style={{
                      margin: 0,
                      maxHeight: 160,
                      overflow: 'auto',
                      fontSize: 'var(--font-size-1)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                )}
              </Flex>
            </Box>
          )}
        </Flex>
      </Box>
    </Card>
  )
}
