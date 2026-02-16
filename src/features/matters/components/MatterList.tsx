import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Badge,
  Box,
  Button,
  Flex,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import {
  ChatBubbleQuestion,
  Check,
  Plus,
  QuestionMark,
  Search,
  Xmark,
} from 'iconoir-react'
import { mattersIndexQueryAll } from '../api/queries'
import type { Matter, MatterType } from '../types'

const MONTH_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'des',
]

function formatMatterDate(dateInput: string | Date): string {
  const d = new Date(dateInput)
  return `${d.getDate()}. ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

type SortBy = 'type' | 'title' | 'created' | 'response' | 'company'
type SortDir = 'asc' | 'desc'

const GRID_COLUMNS =
  'minmax(100px, 1fr) minmax(140px, 2fr) minmax(80px, 1fr) 44px minmax(100px, 1fr)'

const SORTABLE_COLUMNS: Array<{ id: SortBy; header: React.ReactNode }> = [
  { id: 'type', header: 'Type' },
  { id: 'title', header: 'Title' },
  { id: 'created', header: 'Created' },
  { id: 'response', header: <ChatBubbleQuestion width={14} height={14} /> },
  { id: 'company', header: 'Company' },
]

export default function MatterList({
  selectedId,
  onSelect,
  unreadFilter,
  companyFilter,
  typeFilter,
  companies,
  onCreateMatter,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  unreadFilter: boolean
  companyFilter: string[]
  typeFilter: MatterType[]
  companies: Array<{ id: string; name: string }>
  onCreateMatter?: () => void
}) {
  const [search, setSearch] = React.useState('')
  const [sortBy, setSortBy] = React.useState<SortBy>('created')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const {
    data: allMatters = [],
    isLoading,
    isFetching,
  } = useQuery({
    ...mattersIndexQueryAll(),
  })

  const rows = React.useMemo(() => {
    let filtered = allMatters

    if (search.trim()) {
      const searchLower = search.trim().toLowerCase()
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(searchLower) ||
          m.content?.toLowerCase().includes(searchLower) ||
          m.job?.title.toLowerCase().includes(searchLower) ||
          m.created_by?.display_name?.toLowerCase().includes(searchLower) ||
          m.created_by?.email.toLowerCase().includes(searchLower) ||
          (m.created_as_company &&
            m.company?.name.toLowerCase().includes(searchLower)),
      )
    }

    if (typeFilter.length > 0) {
      filtered = filtered.filter((m) => typeFilter.includes(m.matter_type))
    }

    if (unreadFilter) {
      filtered = filtered.filter((m) => m.is_unread === true)
    }

    if (companyFilter.length > 0) {
      filtered = filtered.filter((m) => companyFilter.includes(m.company_id))
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'type':
          comparison = a.matter_type.localeCompare(b.matter_type)
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'created':
          comparison =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'response': {
          const aHasResponse =
            (a.matter_type === 'vote' || a.matter_type === 'crew_invite') &&
            a.my_response
              ? 1
              : 0
          const bHasResponse =
            (b.matter_type === 'vote' || b.matter_type === 'crew_invite') &&
            b.my_response
              ? 1
              : 0
          comparison = aHasResponse - bHasResponse
          break
        }
        case 'company':
          comparison = (a.company?.name || '').localeCompare(
            b.company?.name || '',
          )
          break
      }
      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [
    allMatters,
    search,
    typeFilter,
    unreadFilter,
    companyFilter,
    sortBy,
    sortDir,
  ])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    enabled: rows.length > 0,
  })

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  const getResponseIcon = (matter: Matter) => {
    if (matter.matter_type === 'vote' || matter.matter_type === 'crew_invite') {
      if (matter.my_response) {
        const responseLower = matter.my_response.response.toLowerCase()
        if (responseLower === 'approved' || responseLower === 'accepted') {
          return (
            <Badge radius="full" color="green" size="2">
              <Check width={14} height={14} />
            </Badge>
          )
        }
        if (responseLower === 'rejected' || responseLower === 'declined') {
          return (
            <Badge radius="full" color="red" size="2">
              <Xmark width={14} height={14} />
            </Badge>
          )
        }
        return (
          <Badge
            radius="full"
            color="blue"
            size="2"
            title={matter.my_response.response}
          >
            <QuestionMark width={14} height={14} />
          </Badge>
        )
      }
      return (
        <Badge radius="full" color="gray" size="2" title="No response">
          <QuestionMark width={14} height={14} />
        </Badge>
      )
    }
    return null
  }

  const getTypeBadge = (type: Matter['matter_type']) => {
    const variants: Record<string, { color: string; label: string }> = {
      crew_invite: { color: 'blue', label: 'Invite' },
      vote: { color: 'purple', label: 'Vote' },
      announcement: { color: 'gray', label: 'Announcement' },
      chat: { color: 'green', label: 'Chat' },
      update: { color: 'amber', label: 'Update' },
    }
    const v = variants[type] ?? variants.announcement
    return (
      <Badge radius="full" color={v.color as 'blue' | 'purple' | 'gray' | 'green' | 'amber'}>
        {v.label}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <Box p="4">
        <Text color="gray">Loading matters...</Text>
      </Box>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex ref={controlsRef} gap="2" align="center" wrap="wrap" mb="2">
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search matters…"
          size="3"
          style={{ flex: '1 1 260px' }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner size="2" />}
          </TextField.Slot>
        </TextField.Root>
        {onCreateMatter && (
          <Button size="2" onClick={onCreateMatter}>
            <Plus /> New Matter
          </Button>
        )}
      </Flex>

      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS,
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--gray-a2)',
          borderRadius: 'var(--radius-2)',
          flexShrink: 0,
        }}
      >
        {SORTABLE_COLUMNS.map((col) => {
          const isActive = sortBy === col.id
          const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
          return (
            <div
              key={col.id}
              onClick={() => handleSort(col.id)}
              style={{
                fontSize: 'var(--font-size-1)',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
              title="Click to sort"
            >
              {col.header}
              {arrow}
            </div>
          )
        })}
      </div>

      {/* Virtualized list body */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          marginTop: 8,
        }}
      >
        {rows.length === 0 ? (
          <Flex align="center" justify="center" py="6">
            <Text size="2" color="gray">
              {allMatters.length === 0
                ? 'No matters yet'
                : 'No matters match your filters'}
            </Text>
          </Flex>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const matter = rows[virtualRow.index]
              const isSelected = matter.id === selectedId

              return (
                <div
                  key={matter.id}
                  data-index={virtualRow.index}
                  onClick={() => onSelect(matter.id)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'grid',
                    gridTemplateColumns: GRID_COLUMNS,
                    gap: 'var(--space-2)',
                    alignItems: 'center',
                    padding: '0 var(--space-3)',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--accent-a3)'
                      : 'transparent',
                    borderRadius: 'var(--radius-2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <Flex align="center" gap="2">
                    {getTypeBadge(matter.matter_type)}
                    {matter.is_unread && (
                      <Box
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--blue-9)',
                        }}
                      />
                    )}
                  </Flex>

                  <Box style={{ minWidth: 0 }}>
                    <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                      <Tooltip content={matter.title} delayDuration={300}>
                        <Box
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <Text
                            weight={
                              isSelected
                                ? 'bold'
                                : matter.is_unread
                                  ? 'bold'
                                  : 'medium'
                            }
                            size="2"
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {matter.title}
                          </Text>
                        </Box>
                      </Tooltip>
                      {matter.is_unread && (
                        <Badge radius="full" size="1" color="blue">
                          New
                        </Badge>
                      )}
                    </Flex>
                    {matter.job && (
                      <Text
                        size="1"
                        color="gray"
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Job: {matter.job.title}
                      </Text>
                    )}
                  </Box>

                  <Text size="2" color="gray">
                    {formatMatterDate(matter.created_at)}
                  </Text>

                  <Box>
                    {getResponseIcon(matter) || (
                      <Text size="2" color="gray">
                        —
                      </Text>
                    )}
                  </Box>

                  <Text size="2" color="gray">
                    {matter.company?.name || '—'}
                  </Text>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {rows.length} matter{rows.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}
    </div>
  )
}
