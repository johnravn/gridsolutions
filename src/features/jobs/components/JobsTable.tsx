import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Spinner,
  Table,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useDebouncedValue } from '@tanstack/react-pacer'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarXmark,
  Plus,
  Search,
} from 'iconoir-react'
import { getInitials, makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { jobsIndexQuery } from '../api/queries'
import { getJobStatusColor } from '../utils/statusColors'
import JobDialog from './dialogs/JobDialog'
import type { JobListRow, JobStatus } from '../types'

// Helper function to mask status for freelancers
function getDisplayStatus(
  status: JobStatus,
  companyRole: string | null,
): JobStatus {
  if (companyRole === 'freelancer') {
    // Freelancers should not see statuses beyond 'completed'
    if (status === 'invoiced' || status === 'paid') {
      return 'completed'
    }
  }
  return status
}

type SortBy = 'title' | 'start_at' | 'status' | 'customer_name'
type SortDir = 'asc' | 'desc'

// Using shared getInitials from generalFunctions

export default function JobsTable({
  selectedId,
  onSelect,
  onWidthChange,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  onWidthChange?: (width: number) => void
}) {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [selectedDate, setSelectedDate] = React.useState<string>('')
  const [includeArchived, setIncludeArchived] = React.useState(false)
  const [sortBy, setSortBy] = React.useState<SortBy>('start_at')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const [createOpen, setCreateOpen] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const theadRef = React.useRef<HTMLTableSectionElement>(null)
  const pagerRef = React.useRef<HTMLDivElement>(null)
  // Track if we've calculated initial width to prevent recalculating on every search/filter
  const hasCalculatedInitialWidth = React.useRef(false)

  const {
    data: allData = [],
    isFetching,
    refetch,
  } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '__none__',
      search: debouncedSearch,
      selectedDate,
      sortBy,
      sortDir,
      userId,
      companyRole,
      includeArchived,
    }),
    enabled: !!companyId,
  })

  // Archive/unarchive mutation
  const archiveJob = useMutation({
    mutationFn: async ({
      jobId,
      archived,
    }: {
      jobId: string
      archived: boolean
    }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ archived })
        .eq('id', jobId)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company'] })
      await qc.invalidateQueries({ queryKey: ['jobs-index'] })
      await qc.invalidateQueries({ queryKey: ['jobs-detail'] })
      success('Job updated', 'Job archive status has been updated.')
    },
    onError: (err: any) => {
      showError('Failed to update job', err?.message || 'Please try again.')
    },
  })

  // Recompute page size based on available space
  const recomputePageSize = React.useCallback(() => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const screenH = containerRect.height

    if (screenH === 0) return

    const controlsH = controlsRef.current?.offsetHeight ?? 0
    const theadH = theadRef.current?.offsetHeight ?? 0
    const pagerH = pagerRef.current?.offsetHeight ?? 0

    // Reduced padding to allow for one more row - account for table padding and margins
    const miscPadding = 24

    const available = Math.max(
      0,
      screenH - controlsH - theadH - pagerH - miscPadding,
    )

    if (available < 100) {
      setPageSize(5)
      return
    }

    const visibleRow = containerRef.current.querySelector<HTMLTableRowElement>(
      'tbody tr:not([data-row-probe])',
    )
    const rowH = visibleRow?.getBoundingClientRect().height || 60

    // Calculate rows more accurately - use a small buffer (2px) to account for rounding
    // This allows showing one more row when there's sufficient space
    const rowsWithBuffer = (available + 2) / rowH
    const rows = Math.max(5, Math.min(50, Math.floor(rowsWithBuffer)))
    setPageSize(rows)
  }, [])

  React.useEffect(() => {
    if (!containerRef.current) return

    const onResize = () => recomputePageSize()
    window.addEventListener('resize', onResize)

    const resizeObserver = new ResizeObserver(() => {
      recomputePageSize()
    })

    resizeObserver.observe(containerRef.current)

    const timeoutId = setTimeout(() => {
      recomputePageSize()
    }, 0)

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

  React.useEffect(() => {
    if (allData.length > 0) {
      requestAnimationFrame(() => {
        recomputePageSize()
      })
    }
  }, [allData.length, recomputePageSize])

  // Calculate optimal table width and notify parent
  const calculateOptimalWidth = React.useCallback(() => {
    if (!containerRef.current || !onWidthChange) return

    const table = containerRef.current.querySelector('table')
    if (!table) return

    // Measure the table's scroll width (actual content width)
    const tableScrollWidth = table.scrollWidth

    // Get the container's parent (Card) to account for card padding
    const card = containerRef.current.closest(
      '[class*="Card"], [class*="card"]',
    )
    if (!card) return

    const cardElement = card as HTMLElement
    const cardStyle = window.getComputedStyle(cardElement)
    const cardPaddingLeft = parseFloat(cardStyle.paddingLeft) || 0
    const cardPaddingRight = parseFloat(cardStyle.paddingRight) || 0
    const cardPadding = cardPaddingLeft + cardPaddingRight

    // Get the container (section/page) width for percentage calculation
    const pageContainer = cardElement.closest('section, [class*="Page"]')
    if (!pageContainer) return

    const pageContainerElement = pageContainer as HTMLElement

    const pageWidth = pageContainerElement.getBoundingClientRect().width
    if (pageWidth === 0) return

    // Calculate required width: table width + card padding + small buffer
    const requiredWidth = tableScrollWidth + cardPadding + 32 // 32px buffer for margins/gaps

    // Calculate as percentage of page width
    const widthPercent = (requiredWidth / pageWidth) * 100

    // Respect min/max constraints: min 15%, max 75%
    const constrainedWidth = Math.max(15, Math.min(75, widthPercent))

    onWidthChange(constrainedWidth)
  }, [onWidthChange])

  // Calculate optimal width only once on initial load (when table first renders with data)
  // The table width is based on column structure, not data content, so we don't need to
  // recalculate on every search/filter change
  React.useEffect(() => {
    if (
      !onWidthChange ||
      allData.length === 0 ||
      hasCalculatedInitialWidth.current
    )
      return

    // Use a small delay to ensure table has rendered
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => {
        calculateOptimalWidth()
        hasCalculatedInitialWidth.current = true
      })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [allData.length, calculateOptimalWidth, onWidthChange])

  // Also recalculate on window resize
  React.useEffect(() => {
    if (!onWidthChange) return

    const handleResize = () => {
      requestAnimationFrame(() => {
        calculateOptimalWidth()
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateOptimalWidth, onWidthChange])

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1)
  }, [search, selectedDate, sortBy, sortDir, includeArchived])

  // Paginate the data
  const totalPages = Math.ceil(allData.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const data = allData.slice(startIndex, endIndex)

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  return (
    <Box
      ref={containerRef}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div ref={controlsRef}>
        <Flex gap="2" align="center" mb="3" wrap="wrap">
          <TextField.Root
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="3"
            style={{ flex: 1, minWidth: 200 }}
          >
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
            <TextField.Slot side="right">
              {isFetching && <Spinner />}
            </TextField.Slot>
          </TextField.Root>

          <Button
            size="2"
            variant={includeArchived ? 'classic' : 'soft'}
            onClick={() => setIncludeArchived(!includeArchived)}
          >
            <Archive width={16} height={16} />
            {includeArchived ? 'Hide archived' : 'Show archived'}
          </Button>

          {selectedDate ? (
            <Tooltip
              content={`Selected: ${new Date(selectedDate).toLocaleDateString()}`}
            >
              <IconButton
                size="2"
                variant="soft"
                color="blue"
                onClick={() => setSelectedDate('')}
              >
                <CalendarXmark width={16} height={16} />
              </IconButton>
            </Tooltip>
          ) : (
            <DateTimePicker
              value=""
              onChange={(iso) => {
                // Convert ISO to YYYY-MM-DD for the query (which expects date string)
                if (iso) {
                  const d = new Date(iso)
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  setSelectedDate(dateStr)
                }
              }}
              dateOnly
              iconButton
              iconButtonSize="2"
            />
          )}

          {companyRole !== 'freelancer' && (
            <Button
              size="2"
              variant="solid"
              onClick={() => setCreateOpen(true)}
              style={{ gap: '4px' }}
            >
              <Plus width={16} height={16} />
              New job
            </Button>
          )}
        </Flex>
      </div>
      <JobDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId!}
        mode="create"
        onSaved={(id) => {
          // optional: highlight the newly created job
          onSelect(id)
          // refresh the table so it shows up
          refetch()
        }}
      />

      <Box style={{ flex: 1, minHeight: 0 }}>
        <Table.Root variant="surface">
          <Table.Header ref={theadRef}>
            <Table.Row>
              <Table.ColumnHeaderCell style={{ width: 50 }} />
              <Table.ColumnHeaderCell>
                <Flex
                  align="center"
                  gap="2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('title')}
                >
                  Title
                  {sortBy === 'title' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp width={14} height={14} />
                    ) : (
                      <ArrowDown width={14} height={14} />
                    ))}
                </Flex>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Flex
                  align="center"
                  gap="2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('customer_name')}
                >
                  Customer
                  {sortBy === 'customer_name' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp width={14} height={14} />
                    ) : (
                      <ArrowDown width={14} height={14} />
                    ))}
                </Flex>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Flex
                  align="center"
                  gap="2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('start_at')}
                >
                  Start
                  {sortBy === 'start_at' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp width={14} height={14} />
                    ) : (
                      <ArrowDown width={14} height={14} />
                    ))}
                </Flex>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Flex
                  align="center"
                  gap="2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('status')}
                >
                  Status
                  {sortBy === 'status' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp width={14} height={14} />
                    ) : (
                      <ArrowDown width={14} height={14} />
                    ))}
                </Flex>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: 60, textAlign: 'right' }}>
                Actions
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>No jobs found</Table.Cell>
              </Table.Row>
            ) : (
              data.map((j: JobListRow) => {
                const active = j.id === selectedId
                const projectLead = j.project_lead
                const avatarUrl = projectLead?.avatar_url
                  ? supabase.storage
                      .from('avatars')
                      .getPublicUrl(projectLead.avatar_url).data.publicUrl
                  : null
                const initials = projectLead
                  ? getInitials(projectLead.display_name || projectLead.email)
                  : ''
                const leadName =
                  projectLead?.display_name || projectLead?.email || null

                // Show archive button only for paid or canceled jobs and only if user is project lead
                const isProjectLead = userId && projectLead?.user_id === userId
                const canArchive =
                  (j.status === 'paid' || j.status === 'canceled') &&
                  isProjectLead
                const isPaid = j.status === 'paid'
                const isCanceled = j.status === 'canceled'

                return (
                  <Table.Row
                    key={j.id}
                    onClick={() => onSelect(j.id)}
                    style={{
                      cursor: 'pointer',
                      background: active
                        ? 'var(--accent-a3)'
                        : isPaid
                          ? 'var(--green-a2)'
                          : isCanceled
                            ? 'var(--red-a2)'
                            : undefined,
                    }}
                    data-state={active ? 'active' : undefined}
                  >
                    <Table.Cell style={{ width: 50 }}>
                      {leadName ? (
                        <Tooltip content={leadName}>
                          <Avatar
                            size="2"
                            radius="full"
                            fallback={initials}
                            src={avatarUrl || undefined}
                            style={{ border: '1px solid var(--gray-5)' }}
                          />
                        </Tooltip>
                      ) : (
                        <Avatar
                          size="2"
                          radius="full"
                          fallback="—"
                          style={{
                            border: '1px solid var(--gray-5)',
                            opacity: 0.5,
                          }}
                        />
                      )}
                    </Table.Cell>
                    <Table.Cell>{j.title}</Table.Cell>
                    <Table.Cell>
                      {j.customer?.name ??
                        j.customer_user?.display_name ??
                        j.customer_user?.email ??
                        '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {j.start_at
                        ? (() => {
                            const d = new Date(j.start_at)
                            const hours = String(d.getHours()).padStart(2, '0')
                            const minutes = String(d.getMinutes()).padStart(
                              2,
                              '0',
                            )
                            return (
                              d.toLocaleString(undefined, {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              }) + ` ${hours}:${minutes}`
                            )
                          })()
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {(() => {
                        const displayStatus = getDisplayStatus(
                          j.status,
                          companyRole,
                        )
                        return (
                          <Badge
                            color={getJobStatusColor(displayStatus)}
                            radius="full"
                            highContrast
                          >
                            {makeWordPresentable(displayStatus)}
                          </Badge>
                        )
                      })()}
                    </Table.Cell>
                    <Table.Cell
                      style={{ textAlign: 'right', verticalAlign: 'middle' }}
                    >
                      {canArchive && (
                        <Flex
                          align="center"
                          justify="end"
                          style={{ height: '100%' }}
                        >
                          <Tooltip
                            content={
                              j.archived ? 'Unarchive job' : 'Archive job'
                            }
                          >
                            <IconButton
                              size="2"
                              variant="soft"
                              color={j.archived ? 'blue' : 'gray'}
                              onClick={(e) => {
                                e.stopPropagation()
                                archiveJob.mutate({
                                  jobId: j.id,
                                  archived: !j.archived,
                                })
                              }}
                              disabled={archiveJob.isPending}
                            >
                              <Archive width={18} height={18} />
                            </IconButton>
                          </Tooltip>
                        </Flex>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
            {/* Probe row for height measurement */}
            <Table.Row
              data-row-probe
              style={{
                display: 'none',
              }}
            >
              <Table.Cell colSpan={6}>probe</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </Box>

      {allData.length > 0 && (
        <div ref={pagerRef}>
          <Flex align="center" justify="between" mt="3">
            <Text size="2" color="gray">
              Showing {startIndex + 1}-{Math.min(endIndex, allData.length)} of{' '}
              {allData.length} jobs
            </Text>
            <Flex gap="2">
              <Button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                variant="solid"
                size="2"
              >
                Prev
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                variant="solid"
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
