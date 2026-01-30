import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  Select,
  Spinner,
  Table,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import {
  ArrowDown,
  ArrowUp,
  ChatBubbleQuestion,
  Check,
  QuestionMark,
  Search,
  Xmark,
} from 'iconoir-react'
import { mattersIndexQueryAll } from '../api/queries'
import type { Matter, MatterType } from '../types'

type SortBy = 'type' | 'title' | 'created' | 'response' | 'company'
type SortDir = 'asc' | 'desc'

export default function MatterList({
  selectedId,
  onSelect,
  unreadFilter,
  companyFilter,
  companies,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  unreadFilter: boolean
  companyFilter: string | 'all'
  companies: Array<{ id: string; name: string }>
}) {
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<MatterType | 'all'>('all')
  const [sortBy, setSortBy] = React.useState<SortBy>('created')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10) // Conservative initial value

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const theadRef = React.useRef<HTMLTableSectionElement>(null)
  const pagerRef = React.useRef<HTMLDivElement>(null)

  const {
    data: allMatters = [],
    isLoading,
    isFetching,
  } = useQuery({
    ...mattersIndexQueryAll(),
  })

  // Recompute page size based on available space
  const recomputePageSize = React.useCallback(() => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const screenH = containerRect.height

    // Don't calculate if container has no height yet (layout not ready)
    if (screenH === 0) return

    const controlsH = controlsRef.current?.offsetHeight ?? 0
    const theadH = theadRef.current?.offsetHeight ?? 0
    const pagerH = pagerRef.current?.offsetHeight ?? 0

    const miscPadding = 48 // Increased to account for pagination controls

    const available = Math.max(
      0,
      screenH - controlsH - theadH - pagerH - miscPadding,
    )

    // If available space is too small, use minimum
    if (available < 100) {
      setPageSize(5)
      return
    }

    const visibleRow = containerRef.current?.querySelector<HTMLTableRowElement>(
      'tbody tr:not([data-row-probe])',
    )
    const rowH = visibleRow?.getBoundingClientRect().height || 60

    // Be conservative - don't add extra rows, and use floor to ensure we don't overflow
    const rows = Math.max(5, Math.min(50, Math.floor(available / rowH)))
    setPageSize(rows)
  }, [])

  React.useEffect(() => {
    if (!containerRef.current) return

    const onResize = () => recomputePageSize()
    window.addEventListener('resize', onResize)

    // Use ResizeObserver to watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      recomputePageSize()
    })

    resizeObserver.observe(containerRef.current)

    // Delay initial calculation to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      recomputePageSize()
    }, 0)

    // Also try after a frame to ensure layout is complete
    const rafId = requestAnimationFrame(() => {
      recomputePageSize()
    })

    return () => {
      window.removeEventListener('resize', onResize)
      resizeObserver.disconnect()
      clearTimeout(timeoutId)
      cancelAnimationFrame(rafId)
    }
  }, [recomputePageSize])

  // Recompute when data loads (in case calculation happened before data was available)
  React.useEffect(() => {
    if (!isLoading && allMatters.length > 0) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        recomputePageSize()
      })
    }
  }, [isLoading, allMatters.length, recomputePageSize])

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1)
  }, [search, typeFilter, unreadFilter, companyFilter, sortBy, sortDir])

  // Filter and sort matters client-side
  const allFilteredMatters = React.useMemo(() => {
    let filtered = allMatters

    // Apply search filter
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

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((m) => m.matter_type === typeFilter)
    }

    // Apply unread filter
    if (unreadFilter) {
      filtered = filtered.filter((m) => m.is_unread === true)
    }

    // Apply company filter
    if (companyFilter !== 'all') {
      filtered = filtered.filter((m) => m.company_id === companyFilter)
    }

    // Apply sorting
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
          // For votes and invites: has response = 1, no response = 0
          // For chat and announcements: always 0 (same priority)
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
          const aCompanyName = a.company?.name || ''
          const bCompanyName = b.company?.name || ''
          comparison = aCompanyName.localeCompare(bCompanyName)
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

  // Paginate the filtered matters
  const totalPages = Math.ceil(allFilteredMatters.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const matters = allFilteredMatters.slice(startIndex, endIndex)

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

        // For votes: approved/rejected
        // For crew invites: accepted/declined
        if (responseLower === 'approved' || responseLower === 'accepted') {
          return (
            <Badge radius="full" color="green" size="2">
              <Check width={14} height={14} />
            </Badge>
          )
        } else if (
          responseLower === 'rejected' ||
          responseLower === 'declined'
        ) {
          return (
            <Badge radius="full" color="red" size="2">
              <Xmark width={14} height={14} />
            </Badge>
          )
        } else {
          // Custom response - show question mark
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
      } else {
        // No response yet
        return (
          <Badge radius="full" color="gray" size="2" title="No response">
            <QuestionMark width={14} height={14} />
          </Badge>
        )
      }
    }
    return null
  }

  const getTypeBadge = (type: Matter['matter_type']) => {
    const variants: Record<string, { color: string; label: string }> = {
      crew_invite: { color: 'blue', label: 'Invite' },
      vote: { color: 'purple', label: 'Vote' },
      announcement: { color: 'gray', label: 'Announcement' },
      chat: { color: 'green', label: 'Chat' },
      update: { color: 'blue', label: 'Update' },
    }
    const v = variants[type] ?? variants.announcement
    return (
      <Badge radius="full" color={v.color as any}>
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
    <Box
      ref={containerRef}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div ref={controlsRef}>
        <Flex gap="2" align="center" wrap="wrap" mb="3">
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

          <Select.Root
            value={typeFilter}
            size="3"
            onValueChange={(val) => setTypeFilter(val as MatterType | 'all')}
          >
            <Select.Trigger
              placeholder="Filter type…"
              style={{ minHeight: 'var(--space-7)' }}
            />
            <Select.Content>
              <Select.Item value="all">All Types</Select.Item>
              <Select.Item value="vote">Vote</Select.Item>
              <Select.Item value="announcement">Announcement</Select.Item>
              <Select.Item value="chat">Chat</Select.Item>
              <Select.Item value="update">Update</Select.Item>
              <Select.Item value="crew_invite">Crew Invite</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
      </div>

      <Box style={{ flex: 1, minHeight: 0 }}>
        {matters.length === 0 ? (
          <Box p="4">
            <Text color="gray">
              {allMatters.length === 0
                ? 'No matters yet'
                : 'No matters match your filters'}
            </Text>
          </Box>
        ) : (
          <Table.Root variant="surface">
            <Table.Header ref={theadRef}>
              <Table.Row>
                <Table.ColumnHeaderCell
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('type')}
                >
                  <Flex align="center" gap="1">
                    <Text>Type</Text>
                    {sortBy === 'type' &&
                      (sortDir === 'asc' ? (
                        <ArrowUp width={12} height={12} />
                      ) : (
                        <ArrowDown width={12} height={12} />
                      ))}
                  </Flex>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('title')}
                >
                  <Flex align="center" gap="1">
                    <Text>Title</Text>
                    {sortBy === 'title' &&
                      (sortDir === 'asc' ? (
                        <ArrowUp width={12} height={12} />
                      ) : (
                        <ArrowDown width={12} height={12} />
                      ))}
                  </Flex>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('created')}
                >
                  <Flex align="center" gap="1">
                    <Text>Created</Text>
                    {sortBy === 'created' &&
                      (sortDir === 'asc' ? (
                        <ArrowUp width={12} height={12} />
                      ) : (
                        <ArrowDown width={12} height={12} />
                      ))}
                  </Flex>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('response')}
                >
                  <Flex align="center" gap="1">
                    <ChatBubbleQuestion width={14} height={14} />
                    {sortBy === 'response' &&
                      (sortDir === 'asc' ? (
                        <ArrowUp width={12} height={12} />
                      ) : (
                        <ArrowDown width={12} height={12} />
                      ))}
                  </Flex>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('company')}
                >
                  <Flex align="center" gap="1">
                    <Text>Company</Text>
                    {sortBy === 'company' &&
                      (sortDir === 'asc' ? (
                        <ArrowUp width={12} height={12} />
                      ) : (
                        <ArrowDown width={12} height={12} />
                      ))}
                  </Flex>
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {matters.map((matter) => {
                const isSelected = matter.id === selectedId
                return (
                  <Table.Row
                    key={matter.id}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'var(--blue-a2)' : undefined,
                    }}
                    onClick={() => onSelect(matter.id)}
                  >
                    <Table.Cell>
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
                    </Table.Cell>
                    <Table.Cell style={{ maxWidth: '40%' }}>
                      <Box>
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
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {new Date(matter.created_at).toLocaleDateString()}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {getResponseIcon(matter) || (
                        <Text size="2" color="gray">
                          —
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {matter.company?.name || '—'}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
              {/* Probe row for height measurement - completely hidden */}
              <Table.Row
                data-row-probe
                style={{
                  display: 'none',
                }}
              >
                <Table.Cell colSpan={5}>probe</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        )}
      </Box>

      {allFilteredMatters.length > 0 && (
        <div ref={pagerRef}>
          <Flex align="center" justify="between" mt="3">
            <Text size="2" color="gray">
              Showing {startIndex + 1}-
              {Math.min(endIndex, allFilteredMatters.length)} of{' '}
              {allFilteredMatters.length} matters
            </Text>
            <Flex gap="2">
              <Button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                variant="classic"
                size="2"
              >
                Prev
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                variant="classic"
                size="2"
              >
                Next
              </Button>
            </Flex>
          </Flex>
        </div>
      )}
    </Box>
  )
}
