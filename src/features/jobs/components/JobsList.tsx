import * as React from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
  Button,
  DropdownMenu,
  Flex,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { MOBILE_LIST_BOTTOM_PAD, MobilePageList } from '@app/layout/mobile'
import { useDebouncedValue } from '@tanstack/react-pacer'
import {
  ArrowLeft,
  MoreHoriz,
  NavArrowRight,
  Plus,
  Repeat,
  Search,
} from 'iconoir-react'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { getInitials, makeWordPresentable } from '@shared/lib/generalFunctions'
import { motionEaseRevealOut, motionRevealTransition } from '@shared/lib/motion'
import {
  IndexTableBodySkeleton,
  useIndexTableSelectionKeyboard,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import {
  INDEX_TABLE_ROW_CLASS,
  INDEX_TABLE_ROW_SELECTED_CLASS,
} from '@shared/ui/index-table/indexTableStyles'
import { supabase } from '@shared/api/supabase'
import { jobDetailQuery, jobsIndexInfiniteQuery } from '../api/queries'
import {
  recurringJobDetailQuery,
  recurringJobsIndexQuery,
} from '../api/recurringJobQueries'
import { useAutoUpdateJobsListJobStatuses } from '../hooks/useAutoUpdateJobsListJobStatuses'
import { getJobStatusColor } from '../utils/statusColors'
import { useJobCrewRoleIds } from '../hooks/useJobCrewRoleIds'
import JobDialog from './dialogs/JobDialog'
import RecurringJobDialog from './dialogs/RecurringJobDialog'
import RecurringJobListRow from './RecurringJobListRow'
import type { JobsIndexPageResult } from '../api/queries'
import type { InfiniteData } from '@tanstack/react-query'
import type {
  JobListRow,
  JobStatus,
  JobsListScope,
  JobsPageSelection,
} from '../types'

function getDisplayStatus(
  status: JobStatus,
  companyRole: string | null,
): JobStatus {
  if (companyRole === 'freelancer') {
    if (status === 'invoiced' || status === 'paid') return 'completed'
  }
  return status
}

type SortBy = 'title' | 'start_at' | 'status' | 'customer_name'
type SortDir = 'asc' | 'desc'

type MyJobRole = 'crew' | 'project_lead' | 'both' | null

const GRID_COLUMNS = 'minmax(0, 1fr) minmax(90px, auto) auto'

/** Radix ghost uses content-box + negative margins; neutralize so padding
 *  isn't clipped by the jobs list's overflow:hidden. */
const recurringHideButtonStyle = {
  flexShrink: 0,
  boxSizing: 'border-box',
  '--margin-top-override': '0px',
  '--margin-right-override': '0px',
  '--margin-bottom-override': '0px',
  '--margin-left-override': '0px',
  margin: 0,
} as React.CSSProperties

export default function JobsList({
  createShortcutRef,
  selection,
  onSelectJob,
  onSelectRecurringJob,
  statusFilter,
  showOnlyArchived,
  showJobsInRecurringSeries = false,
  dateFrom,
  dateTo,
  readyToInvoiceFilter = false,
  compact = false,
  toolbarExtra,
  listScope = null,
  onExitListScope,
}: {
  /** Binds the page-level create shortcut to this list's create dialog. */
  createShortcutRef?: React.MutableRefObject<(() => void) | null>
  selection: JobsPageSelection
  onSelectJob: (id: string | null) => void
  onSelectRecurringJob: (id: string | null, title?: string) => void
  statusFilter: Array<JobStatus>
  showOnlyArchived: boolean
  showJobsInRecurringSeries?: boolean
  /** Local calendar YYYY-MM-DD — jobs starting in this period. */
  dateFrom: string
  dateTo: string
  /** Same criteria as homepage: completed + current user is project lead */
  readyToInvoiceFilter?: boolean
  /** When true, use a stacked card layout for better mobile display */
  compact?: boolean
  toolbarExtra?: React.ReactNode
  /** When set, show only member jobs for this recurring series */
  listScope?: JobsListScope
  onExitListScope?: () => void
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { userId, companyRole } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const isSmallScreen = useMediaQuery('(max-width: 768px)')
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [sortBy, setSortBy] = React.useState<SortBy>('start_at')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [createOpen, setCreateOpen] = React.useState(false)
  React.useEffect(() => {
    if (!createShortcutRef) return
    createShortcutRef.current = () => setCreateOpen(true)
    return () => {
      createShortcutRef.current = null
    }
  }, [createShortcutRef])
  const [createRecurringOpen, setCreateRecurringOpen] = React.useState(false)
  const [recurringJobsOpen, setRecurringJobsOpen] = React.useState(true)
  const [recurringHeaderHovered, setRecurringHeaderHovered] =
    React.useState(false)

  const selectedJobId = selection?.kind === 'job' ? selection.id : null
  const selectedRecurringJobId =
    selection?.kind === 'recurring_job' ? selection.id : null

  const jobsQuery = useInfiniteQuery({
    ...jobsIndexInfiniteQuery({
      companyId: companyId ?? '__none__',
      search: debouncedSearch,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy,
      sortDir,
      userId,
      companyRole,
      showOnlyArchived,
      projectLeadUserId: readyToInvoiceFilter ? userId : null,
      statuses: readyToInvoiceFilter
        ? ['completed']
        : statusFilter.length > 0
          ? statusFilter
          : null,
      includeRecurringMembers:
        companyRole === 'freelancer' ||
        showJobsInRecurringSeries ||
        readyToInvoiceFilter,
    }),
    enabled: !!companyId && !listScope,
  })

  const { data: scopedRecurringDetail, isLoading: scopedLoading } = useQuery({
    ...recurringJobDetailQuery({
      recurringJobId: listScope?.id ?? '__none__',
    }),
    enabled: !!listScope?.id,
  })

  const {
    isLoading,
    isFetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = jobsQuery
  const allData = React.useMemo(
    () => jobsQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [jobsQuery.data],
  )
  const totalCount = jobsQuery.data?.pages[0]?.count ?? 0

  useAutoUpdateJobsListJobStatuses(allData, !!companyId)

  const selectedJobDetail = useQuery({
    ...jobDetailQuery({ jobId: selectedJobId ?? '__none__' }),
    enabled: !!companyId && !!selectedJobId,
  })

  const { data: pinnedRecurringJobs = [] } = useQuery({
    ...recurringJobsIndexQuery({
      companyId: companyId ?? '__none__',
      includeArchived: false,
    }),
    enabled: !!companyId && companyRole !== 'freelancer',
  })

  const { data: searchableRecurringJobs = [] } = useQuery({
    ...recurringJobsIndexQuery({
      companyId: companyId ?? '__none__',
      search: debouncedSearch,
      includeArchived: false,
    }),
    enabled: !!companyId && debouncedSearch.trim().length > 0,
  })

  const pinnedIds = React.useMemo(
    () => new Set(pinnedRecurringJobs.map((r) => r.id)),
    [pinnedRecurringJobs],
  )

  const searchRecurringHits = React.useMemo(() => {
    if (!debouncedSearch.trim()) return []
    return searchableRecurringJobs.filter((r) => !pinnedIds.has(r.id))
  }, [debouncedSearch, searchableRecurringJobs, pinnedIds])

  React.useEffect(() => {
    if (!companyId || !selectedJobId) return
    const detail = selectedJobDetail.data
    if (!detail) return
    const nextStatus = detail.status
    const row = allData.find((r) => r.id === selectedJobId)
    if (row?.status === nextStatus) return

    qc.setQueriesData<Array<JobListRow>>(
      { queryKey: ['company', companyId, 'jobs-index'], exact: false },
      (old) => {
        if (!old) return old
        return old.map((r) =>
          r.id === selectedJobId ? { ...r, status: nextStatus } : r,
        )
      },
    )
    qc.setQueriesData<{ rows: Array<JobListRow>; count: number }>(
      { queryKey: ['company', companyId, 'jobs-index-page'], exact: false },
      (old) => {
        if (!old) return old
        return {
          ...old,
          rows: old.rows.map((r) =>
            r.id === selectedJobId ? { ...r, status: nextStatus } : r,
          ),
        }
      },
    )
    qc.setQueriesData<InfiniteData<JobsIndexPageResult>>(
      { queryKey: ['company', companyId, 'jobs-index-infinite'], exact: false },
      (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            rows: page.rows.map((r) =>
              r.id === selectedJobId ? { ...r, status: nextStatus } : r,
            ),
          })),
        }
      },
    )
  }, [
    allData,
    companyId,
    qc,
    selectedJobId,
    selectedJobDetail.data,
    selectedJobDetail.dataUpdatedAt,
  ])

  const rows = allData

  const crewJobIdSet = useJobCrewRoleIds({
    companyId,
    userId,
    jobIds: rows.map((r) => r.id),
  })

  const getMyJobRole = (job: JobListRow): MyJobRole => {
    const isProjectLead = !!userId && job.project_lead?.user_id === userId
    const isCrew = crewJobIdSet.has(job.id)
    if (isProjectLead) return isCrew ? 'both' : 'project_lead'
    if (isCrew) return 'crew'
    return null
  }

  const showRecurringHide =
    recurringJobsOpen && (isSmallScreen || compact || recurringHeaderHovered)

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (r) => r.id,
    estimateRowSize: compact ? 88 : 64,
    overscan: 10,
    isFetching,
    infinite: {
      hasNextPage,
      isFetchingNextPage,
      onLoadMore: () => {
        void fetchNextPage()
      },
    },
  })

  React.useLayoutEffect(() => {
    if (rows.length === 0 || isLoading) return
    rowVirtualizer.measure()
  }, [rows.length, isLoading, rowVirtualizer])

  useIndexTableSelectionKeyboard({
    enabled: selectedJobId != null,
    selectedId: selectedJobId,
    getIds: () => rows.map((r) => r.id),
    onSelect: (id) => onSelectJob(id),
    scrollToIndex: (index) => {
      rowVirtualizer.scrollToIndex(index, { align: 'auto' })
    },
  })

  const visibleRecurringIds = React.useMemo(() => {
    if (readyToInvoiceFilter) return []
    if (searchRecurringHits.length > 0) {
      return searchRecurringHits.map((r) => r.id)
    }
    if (recurringJobsOpen) {
      return pinnedRecurringJobs.map((r) => r.id)
    }
    return []
  }, [
    readyToInvoiceFilter,
    searchRecurringHits,
    recurringJobsOpen,
    pinnedRecurringJobs,
  ])

  useIndexTableSelectionKeyboard({
    enabled: selectedRecurringJobId != null,
    selectedId: selectedRecurringJobId,
    getIds: () => visibleRecurringIds,
    onSelect: (id) => onSelectRecurringJob(id),
  })

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  const getAvatarUrl = (avatarPath: string | null): string | null => {
    if (!avatarPath) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
    return data.publicUrl
  }

  const toolbar = (
    <Flex
      gap={compact ? '4' : '2'}
      align="center"
      wrap="wrap"
      direction={compact ? 'column' : 'row'}
    >
      <Flex
        gap="3"
        align="center"
        wrap="wrap"
        style={{ width: compact ? '100%' : undefined, flex: 1, minWidth: 0 }}
      >
        <TextField.Root
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="3"
          style={
            compact
              ? { flex: 1, width: '100%', minWidth: 0 }
              : { flex: '1 1 200px', minWidth: 140 }
          }
        >
          <TextField.Slot side="left">
            <Search width={20} height={20} />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner size="3" />}
          </TextField.Slot>
        </TextField.Root>
        {compact ? toolbarExtra : null}
      </Flex>
      {canWrite && (
        <Flex
          gap="2"
          align="center"
          style={compact ? { width: '100%' } : undefined}
        >
          <Button
            variant="solid"
            size="3"
            onClick={() => setCreateOpen(true)}
            style={compact ? { flex: 1 } : undefined}
          >
            <Plus width={18} height={18} />
            New job
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button
                variant="soft"
                size="3"
                aria-label="More job actions"
                style={{
                  padding: 0,
                  width: 'var(--base-button-height)',
                  minWidth: 'var(--base-button-height)',
                }}
              >
                <MoreHoriz width={18} height={18} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onSelect={() => setCreateRecurringOpen(true)}>
                New recurring job
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Flex>
      )}
    </Flex>
  )

  const dialogs = (
    <>
      <JobDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId!}
        mode="create"
        onSaved={(id) => {
          onSelectJob(id)
          refetch()
        }}
      />
      <RecurringJobDialog
        open={createRecurringOpen}
        onOpenChange={setCreateRecurringOpen}
        companyId={companyId!}
        mode="create"
        onSaved={(id) => {
          onSelectRecurringJob(id)
        }}
      />
    </>
  )

  const scopedMemberRows = React.useMemo(() => {
    if (!listScope) return []
    const scopedMemberJobs = scopedRecurringDetail?.jobs ?? []
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return scopedMemberJobs
    return scopedMemberJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.jobnr != null && String(j.jobnr).includes(q)),
    )
  }, [listScope, scopedRecurringDetail, debouncedSearch])

  const scopedHeader = listScope ? (
    <Flex
      direction="column"
      gap="1"
      mb="2"
      width="100%"
      style={{ minWidth: 0 }}
    >
      <Flex align="center" justify="between" gap="2" width="100%">
        <Button
          size="3"
          variant="soft"
          style={{ flexShrink: 0 }}
          onClick={() => onExitListScope?.()}
        >
          <ArrowLeft width={16} height={16} />
          All jobs
        </Button>
        <Button
          size="3"
          variant="soft"
          color="violet"
          style={{ flexShrink: 0 }}
          onClick={() => onSelectRecurringJob(listScope.id, listScope.title)}
        >
          <Repeat width={16} height={16} />
          Series overview
          <NavArrowRight width={16} height={16} />
        </Button>
      </Flex>
      <Text size="2" weight="bold" truncate title={listScope.title}>
        {listScope.title}
      </Text>
    </Flex>
  ) : null

  if (listScope) {
    if (compact) {
      return (
        <MobilePageList toolbar={toolbar}>
          {dialogs}
          {scopedHeader}
          {scopedLoading ? (
            <IndexTableBodySkeleton rowCount={6} rowHeight={88} />
          ) : scopedMemberRows.length === 0 ? (
            <Text size="2" color="gray">
              No jobs in this series
            </Text>
          ) : (
            <Flex
              direction="column"
              gap="2"
              style={{ paddingBottom: MOBILE_LIST_BOTTOM_PAD }}
            >
              {scopedMemberRows.map((job) => (
                <JobIndexRow
                  key={job.id}
                  job={job}
                  compact
                  isSelected={job.id === selectedJobId}
                  companyRole={companyRole}
                  myRole={getMyJobRole(job)}
                  onSelect={() => onSelectJob(job.id)}
                  getAvatarUrl={getAvatarUrl}
                />
              ))}
            </Flex>
          )}
        </MobilePageList>
      )
    }

    return (
      <div
        style={{
          flex: 1,
          height: '100%',
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box mb="2" style={{ flexShrink: 0 }}>
          {toolbar}
        </Box>
        {dialogs}
        {scopedHeader}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div
            style={{
              minWidth: 'max-content',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
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
              <div
                style={{
                  fontSize: 'var(--font-size-1)',
                  fontWeight: 600,
                }}
              >
                General
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-1)',
                  fontWeight: 600,
                  justifySelf: 'start',
                }}
                aria-hidden
              />
              <div
                style={{
                  fontSize: 'var(--font-size-1)',
                  fontWeight: 600,
                  justifySelf: 'start',
                }}
              >
                Lead
              </div>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                marginTop: 8,
              }}
            >
              {scopedLoading ? (
                <Box p="3">
                  <IndexTableBodySkeleton rowCount={8} />
                </Box>
              ) : scopedMemberRows.length === 0 ? (
                <Flex align="center" justify="center" py="6">
                  <Text size="2" color="gray">
                    No jobs in this series
                  </Text>
                </Flex>
              ) : (
                <Flex direction="column" gap="1">
                  {scopedMemberRows.map((job) => (
                    <JobIndexRow
                      key={job.id}
                      job={job}
                      isSelected={job.id === selectedJobId}
                      companyRole={companyRole}
                      myRole={getMyJobRole(job)}
                      onSelect={() => onSelectJob(job.id)}
                      getAvatarUrl={getAvatarUrl}
                    />
                  ))}
                </Flex>
              )}
            </div>
          </div>
        </div>
        {scopedMemberRows.length > 0 && (
          <Flex align="center" mt="2" style={{ flexShrink: 0 }}>
            <Text size="2" color="gray">
              {scopedMemberRows.length} job
              {scopedMemberRows.length !== 1 ? 's' : ''}
            </Text>
          </Flex>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <MobilePageList toolbar={toolbar}>
        {dialogs}
        {pinnedRecurringJobs.length > 0 && !readyToInvoiceFilter && (
          <Box>
            <Flex
              align="center"
              justify="between"
              gap="2"
              mb={recurringJobsOpen ? '1' : '0'}
              onClick={
                !recurringJobsOpen
                  ? () => setRecurringJobsOpen(true)
                  : undefined
              }
              onKeyDown={
                !recurringJobsOpen
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setRecurringJobsOpen(true)
                      }
                    }
                  : undefined
              }
              role={!recurringJobsOpen ? 'button' : undefined}
              tabIndex={!recurringJobsOpen ? 0 : undefined}
              aria-expanded={recurringJobsOpen}
              style={{
                minHeight: 24,
                cursor: !recurringJobsOpen ? 'pointer' : undefined,
                borderRadius: 'var(--radius-2)',
                padding: '2px 0',
                margin: '-2px 0',
              }}
            >
              <Flex align="center" gap="1" style={{ minWidth: 0 }}>
                {!recurringJobsOpen && (
                  <NavArrowRight
                    width={14}
                    height={14}
                    color="var(--gray-11)"
                  />
                )}
                <Text size="1" weight="medium" color="gray">
                  Recurring jobs
                </Text>
                {!recurringJobsOpen && (
                  <Badge variant="soft" color="gray" size="1">
                    {pinnedRecurringJobs.length}
                  </Badge>
                )}
              </Flex>
              {recurringJobsOpen && (
                <Button
                  size="1"
                  variant="ghost"
                  color="gray"
                  aria-label="Hide recurring jobs"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRecurringJobsOpen(false)
                  }}
                  style={recurringHideButtonStyle}
                >
                  Hide
                </Button>
              )}
            </Flex>
            {recurringJobsOpen &&
              pinnedRecurringJobs.map((row) => (
                <RecurringJobListRow
                  key={row.id}
                  row={row}
                  compact
                  isSelected={selectedRecurringJobId === row.id}
                  onClick={() => onSelectRecurringJob(row.id, row.title)}
                />
              ))}
          </Box>
        )}
        {searchRecurringHits.length > 0 && !readyToInvoiceFilter && (
          <Box>
            {searchRecurringHits.map((row) => (
              <RecurringJobListRow
                key={row.id}
                row={row}
                compact
                isSelected={selectedRecurringJobId === row.id}
                onClick={() => onSelectRecurringJob(row.id, row.title)}
              />
            ))}
          </Box>
        )}
        {isLoading ? (
          <IndexTableBodySkeleton rowCount={8} rowHeight={88} />
        ) : rows.length === 0 &&
          !hasNextPage &&
          (readyToInvoiceFilter || searchRecurringHits.length === 0) ? (
          <Text size="2" color="gray">
            {allData.length === 0
              ? 'No jobs yet'
              : 'No jobs match your filters'}
          </Text>
        ) : (
          <Flex
            direction="column"
            gap="2"
            style={{ paddingBottom: MOBILE_LIST_BOTTOM_PAD }}
          >
            {rows.map((job) => (
              <JobIndexRow
                key={job.id}
                job={job}
                compact
                isSelected={job.id === selectedJobId}
                companyRole={companyRole}
                myRole={getMyJobRole(job)}
                onSelect={() => onSelectJob(job.id)}
                getAvatarUrl={getAvatarUrl}
              />
            ))}
            {hasNextPage && (
              <Button
                variant="soft"
                onClick={() => {
                  void fetchNextPage()
                }}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Loading more…' : 'Load more'}
              </Button>
            )}
          </Flex>
        )}
        {rows.length > 0 && (
          <Text size="2" color="gray">
            {totalCount} job{totalCount !== 1 ? 's' : ''}
          </Text>
        )}
      </MobilePageList>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box mb="2" style={{ flexShrink: 0 }}>
        {toolbar}
      </Box>
      {dialogs}

      {pinnedRecurringJobs.length > 0 && !readyToInvoiceFilter && (
        <Box mb="2" style={{ flexShrink: 0 }}>
          <Flex
            align="center"
            justify="between"
            gap="2"
            mb={recurringJobsOpen ? '1' : '0'}
            onMouseEnter={() => setRecurringHeaderHovered(true)}
            onMouseLeave={() => setRecurringHeaderHovered(false)}
            onClick={
              !recurringJobsOpen ? () => setRecurringJobsOpen(true) : undefined
            }
            onKeyDown={
              !recurringJobsOpen
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setRecurringJobsOpen(true)
                    }
                  }
                : undefined
            }
            role={!recurringJobsOpen ? 'button' : undefined}
            tabIndex={!recurringJobsOpen ? 0 : undefined}
            aria-expanded={recurringJobsOpen}
            style={{
              minHeight: 24,
              cursor: !recurringJobsOpen ? 'pointer' : undefined,
              borderRadius: 'var(--radius-2)',
              padding: '2px 0',
              margin: '-2px 0',
            }}
          >
            <Flex align="center" gap="1" style={{ minWidth: 0 }}>
              {!recurringJobsOpen && (
                <NavArrowRight width={14} height={14} color="var(--gray-11)" />
              )}
              <Text size="1" weight="medium" color="gray">
                Recurring jobs
              </Text>
              {!recurringJobsOpen && (
                <Badge variant="soft" color="gray" size="1">
                  {pinnedRecurringJobs.length}
                </Badge>
              )}
            </Flex>
            {recurringJobsOpen && (
              <Button
                size="1"
                variant="ghost"
                color="gray"
                aria-label="Hide recurring jobs"
                onClick={(e) => {
                  e.stopPropagation()
                  setRecurringJobsOpen(false)
                }}
                style={{
                  ...recurringHideButtonStyle,
                  opacity: showRecurringHide ? 1 : 0,
                  pointerEvents: showRecurringHide ? 'auto' : 'none',
                  transition: motionRevealTransition(['opacity'], {
                    ease: motionEaseRevealOut,
                  }),
                }}
              >
                Hide
              </Button>
            )}
          </Flex>
          {recurringJobsOpen &&
            pinnedRecurringJobs.map((row) => (
              <RecurringJobListRow
                key={row.id}
                row={row}
                compact={compact}
                isSelected={selectedRecurringJobId === row.id}
                onClick={() => onSelectRecurringJob(row.id, row.title)}
              />
            ))}
        </Box>
      )}

      {/* Table: header + body in horizontal scroll when !compact (so headers scroll with rows) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowX: compact ? 'hidden' : 'auto',
          overflowY: 'hidden',
        }}
      >
        <div
          style={{
            minWidth: compact ? undefined : 'max-content',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {!compact && (
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
              <div
                onClick={() => handleSort('start_at')}
                style={{
                  fontSize: 'var(--font-size-1)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                }}
                title="Click to sort by date"
              >
                General
                {sortBy === 'start_at' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-1)',
                  fontWeight: 600,
                  justifySelf: 'start',
                }}
                aria-hidden
              />
              <div
                style={{
                  fontSize: 'var(--font-size-1)',
                  fontWeight: 600,
                  justifySelf: 'start',
                }}
              >
                Lead
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              marginTop: 8,
            }}
          >
            {searchRecurringHits.length > 0 && !readyToInvoiceFilter && (
              <Box mb="2">
                {searchRecurringHits.map((row) => (
                  <RecurringJobListRow
                    key={row.id}
                    row={row}
                    compact={compact}
                    isSelected={selectedRecurringJobId === row.id}
                    onClick={() => onSelectRecurringJob(row.id, row.title)}
                  />
                ))}
              </Box>
            )}
            {isLoading ? (
              <Box p="3">
                <IndexTableBodySkeleton rowCount={8} />
              </Box>
            ) : rows.length === 0 &&
              !hasNextPage &&
              (readyToInvoiceFilter || searchRecurringHits.length === 0) ? (
              <Flex align="center" justify="center" py="6">
                <Text size="2" color="gray">
                  {allData.length === 0
                    ? 'No jobs yet'
                    : 'No jobs match your filters'}
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
                  const isLoaderRow = virtualRow.index >= rows.length
                  if (isLoaderRow) {
                    return (
                      <div
                        key={`loader-${virtualRow.index}`}
                        style={{
                          position: 'absolute',
                          top: `${virtualRow.start}px`,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 var(--space-3)',
                          color: 'var(--gray-10)',
                        }}
                      >
                        <Text size="2" color="gray">
                          {isFetchingNextPage
                            ? 'Loading more…'
                            : 'Scroll to load more…'}
                        </Text>
                      </div>
                    )
                  }

                  const job = rows[virtualRow.index]
                  const isSelected = job.id === selectedJobId
                  const displayStatus = getDisplayStatus(
                    job.status,
                    companyRole,
                  )
                  const myRole = getMyJobRole(job)
                  const isCanceled = job.status === 'canceled'
                  const showCrewBadge =
                    !isCanceled && (myRole === 'crew' || myRole === 'both')
                  const customerName =
                    job.customer?.name ??
                    job.customer_user?.display_name ??
                    job.customer_user?.email ??
                    '—'
                  const leadName =
                    job.project_lead?.display_name ||
                    job.project_lead?.email ||
                    'Unassigned'
                  const initials = getInitials(
                    job.project_lead?.display_name ??
                      job.project_lead?.email ??
                      '',
                  )
                  const avatarUrl = getAvatarUrl(
                    job.project_lead?.avatar_url ?? null,
                  )

                  return (
                    <div
                      key={job.id}
                      data-index={virtualRow.index}
                      className={[
                        INDEX_TABLE_ROW_CLASS,
                        isSelected
                          ? INDEX_TABLE_ROW_SELECTED_CLASS
                          : compact
                            ? 'index-table-row--muted'
                            : undefined,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => onSelectJob(job.id)}
                      style={{
                        position: 'absolute',
                        top: `${virtualRow.start}px`,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        display: compact ? 'block' : 'grid',
                        gridTemplateColumns: compact ? undefined : GRID_COLUMNS,
                        gap: compact ? undefined : 'var(--space-2)',
                        alignItems: 'center',
                        padding: compact
                          ? 'var(--space-3)'
                          : '0 var(--space-3)',
                        cursor: 'pointer',
                        borderRadius: compact
                          ? 'var(--radius-3)'
                          : 'var(--radius-2)',
                        marginBottom: 0,
                      }}
                    >
                      {compact ? (
                        <Flex
                          justify="between"
                          align="start"
                          gap="3"
                          style={{ width: '100%', minWidth: 0 }}
                        >
                          <Flex
                            direction="column"
                            gap="1"
                            style={{ minWidth: 0, flex: 1 }}
                          >
                            <Flex
                              gap="2"
                              align="center"
                              wrap="wrap"
                              style={{ minWidth: 0 }}
                            >
                              {job.recurring_job && (
                                <Tooltip
                                  content="Recurring job"
                                  delayDuration={300}
                                >
                                  <Box
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      backgroundColor: 'var(--violet-9)',
                                      flexShrink: 0,
                                    }}
                                  />
                                </Tooltip>
                              )}
                              <Text
                                weight={isSelected ? 'bold' : 'medium'}
                                size="2"
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  minWidth: 0,
                                }}
                              >
                                {job.title}
                              </Text>
                              {showCrewBadge && (
                                <Badge size="1" color="orange" variant="soft">
                                  You are crew
                                </Badge>
                              )}
                            </Flex>
                            <Flex
                              gap="2"
                              align="center"
                              style={{ minWidth: 0 }}
                            >
                              <Text
                                size="1"
                                color="gray"
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  minWidth: 0,
                                }}
                              >
                                {customerName}
                              </Text>
                              <Text size="1" color="gray">
                                •
                              </Text>
                              <Text size="1" color="gray">
                                {job.start_at
                                  ? format(
                                      new Date(job.start_at),
                                      'd. MMM yyyy',
                                      { locale: nb },
                                    )
                                  : '—'}
                              </Text>
                            </Flex>
                          </Flex>
                          <Flex
                            gap="2"
                            align="center"
                            style={{ flexShrink: 0 }}
                          >
                            <Badge
                              color={getJobStatusColor(displayStatus)}
                              radius="full"
                              size="2"
                              highContrast
                              style={{
                                width: 'fit-content',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {makeWordPresentable(displayStatus)}
                            </Badge>
                            <Avatar
                              size="2"
                              src={avatarUrl ?? undefined}
                              fallback={initials}
                              radius="full"
                              style={{ flexShrink: 0 }}
                            />
                          </Flex>
                        </Flex>
                      ) : (
                        <>
                          <Box style={{ minWidth: 0 }}>
                            <Flex
                              gap="2"
                              align="center"
                              wrap="wrap"
                              style={{ minWidth: 0 }}
                            >
                              {job.recurring_job && (
                                <Tooltip
                                  content="Recurring job"
                                  delayDuration={300}
                                >
                                  <Box
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      backgroundColor: 'var(--violet-9)',
                                      flexShrink: 0,
                                    }}
                                  />
                                </Tooltip>
                              )}
                              <Tooltip content={job.title} delayDuration={300}>
                                <Text
                                  weight={isSelected ? 'bold' : 'medium'}
                                  size="2"
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    minWidth: 0,
                                  }}
                                >
                                  {job.title}
                                </Text>
                              </Tooltip>
                              {showCrewBadge && (
                                <Badge size="1" color="orange" variant="soft">
                                  You are crew
                                </Badge>
                              )}
                            </Flex>
                            <Flex
                              gap="2"
                              align="center"
                              style={{
                                minWidth: 0,
                                marginTop: 'var(--space-1)',
                              }}
                            >
                              <Text
                                size="1"
                                color="gray"
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  minWidth: 0,
                                }}
                              >
                                {customerName}
                              </Text>
                              <Text size="1" color="gray">
                                •
                              </Text>
                              <Text size="1" color="gray">
                                {job.start_at
                                  ? format(
                                      new Date(job.start_at),
                                      'd. MMM yyyy',
                                      {
                                        locale: nb,
                                      },
                                    )
                                  : '—'}
                              </Text>
                            </Flex>
                          </Box>
                          <Box
                            style={{
                              minWidth: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              justifySelf: 'start',
                            }}
                          >
                            <Badge
                              color={getJobStatusColor(displayStatus)}
                              radius="full"
                              size="2"
                              highContrast
                              style={{
                                width: 'fit-content',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {makeWordPresentable(displayStatus)}
                            </Badge>
                          </Box>
                          <Flex
                            gap="2"
                            align="center"
                            style={{ minWidth: 0, justifySelf: 'start' }}
                          >
                            <Text
                              size="1"
                              color="gray"
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0,
                              }}
                            >
                              {leadName}
                            </Text>
                            <Avatar
                              size="2"
                              src={avatarUrl ?? undefined}
                              fallback={initials}
                              radius="full"
                              style={{ flexShrink: 0 }}
                            />
                          </Flex>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <Flex align="center" mt="2" style={{ flexShrink: 0 }}>
          <Text size="2" color="gray">
            {totalCount} job{totalCount !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}
    </div>
  )
}

function JobIndexRow({
  job,
  isSelected,
  companyRole,
  myRole,
  onSelect,
  getAvatarUrl,
  compact = false,
}: {
  job: JobListRow
  isSelected: boolean
  companyRole: string | null
  myRole: MyJobRole
  onSelect: () => void
  getAvatarUrl: (avatarPath: string | null) => string | null
  compact?: boolean
}) {
  const displayStatus = getDisplayStatus(job.status, companyRole)
  const isCanceled = job.status === 'canceled'
  const showCrewBadge = !isCanceled && (myRole === 'crew' || myRole === 'both')
  const customerName =
    job.customer?.name ??
    job.customer_user?.display_name ??
    job.customer_user?.email ??
    '—'
  const leadName =
    job.project_lead?.display_name || job.project_lead?.email || 'Unassigned'
  const initials = getInitials(
    job.project_lead?.display_name ?? job.project_lead?.email ?? '',
  )
  const avatarUrl = getAvatarUrl(job.project_lead?.avatar_url ?? null)

  return (
    <div
      className={[
        INDEX_TABLE_ROW_CLASS,
        isSelected
          ? INDEX_TABLE_ROW_SELECTED_CLASS
          : compact
            ? 'index-table-row--muted'
            : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        display: compact ? 'block' : 'grid',
        gridTemplateColumns: compact ? undefined : GRID_COLUMNS,
        gap: compact ? undefined : 'var(--space-2)',
        alignItems: 'center',
        padding: compact ? 'var(--space-3)' : '0 var(--space-3)',
        minHeight: compact ? undefined : 64,
        cursor: 'pointer',
        borderRadius: compact ? 'var(--radius-3)' : 'var(--radius-2)',
      }}
    >
      {compact ? (
        <Flex
          justify="between"
          align="start"
          gap="3"
          style={{ width: '100%', minWidth: 0 }}
        >
          <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
            <Flex gap="2" align="center" wrap="wrap" style={{ minWidth: 0 }}>
              {job.recurring_job && (
                <Tooltip content="Recurring job" delayDuration={300}>
                  <Box
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: 'var(--violet-9)',
                      flexShrink: 0,
                    }}
                  />
                </Tooltip>
              )}
              <Text
                weight={isSelected ? 'bold' : 'medium'}
                size="2"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {job.title}
              </Text>
              {showCrewBadge && (
                <Badge size="1" color="orange" variant="soft">
                  You are crew
                </Badge>
              )}
            </Flex>
            <Flex gap="2" align="center" style={{ minWidth: 0 }}>
              <Text
                size="1"
                color="gray"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {customerName}
              </Text>
              <Text size="1" color="gray">
                •
              </Text>
              <Text size="1" color="gray">
                {job.start_at
                  ? format(new Date(job.start_at), 'd. MMM yyyy', {
                      locale: nb,
                    })
                  : '—'}
              </Text>
            </Flex>
          </Flex>
          <Flex gap="2" align="center" style={{ flexShrink: 0 }}>
            <Badge
              color={getJobStatusColor(displayStatus)}
              radius="full"
              size="2"
              highContrast
              style={{ width: 'fit-content', whiteSpace: 'nowrap' }}
            >
              {makeWordPresentable(displayStatus)}
            </Badge>
            <Avatar
              size="2"
              src={avatarUrl ?? undefined}
              fallback={initials}
              radius="full"
              style={{ flexShrink: 0 }}
            />
          </Flex>
        </Flex>
      ) : (
        <>
          <Box style={{ minWidth: 0 }}>
            <Flex gap="2" align="center" wrap="wrap" style={{ minWidth: 0 }}>
              {job.recurring_job && (
                <Tooltip content="Recurring job" delayDuration={300}>
                  <Box
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: 'var(--violet-9)',
                      flexShrink: 0,
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip content={job.title} delayDuration={300}>
                <Text
                  weight={isSelected ? 'bold' : 'medium'}
                  size="2"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {job.title}
                </Text>
              </Tooltip>
              {showCrewBadge && (
                <Badge size="1" color="orange" variant="soft">
                  You are crew
                </Badge>
              )}
            </Flex>
            <Flex
              gap="2"
              align="center"
              style={{
                minWidth: 0,
                marginTop: 'var(--space-1)',
              }}
            >
              <Text
                size="1"
                color="gray"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {customerName}
              </Text>
              <Text size="1" color="gray">
                •
              </Text>
              <Text size="1" color="gray">
                {job.start_at
                  ? format(new Date(job.start_at), 'd. MMM yyyy', {
                      locale: nb,
                    })
                  : '—'}
              </Text>
            </Flex>
          </Box>
          <Box
            style={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              justifySelf: 'start',
            }}
          >
            <Badge
              color={getJobStatusColor(displayStatus)}
              radius="full"
              size="2"
              highContrast
              style={{
                width: 'fit-content',
                whiteSpace: 'nowrap',
              }}
            >
              {makeWordPresentable(displayStatus)}
            </Badge>
          </Box>
          <Flex
            gap="2"
            align="center"
            style={{ minWidth: 0, justifySelf: 'start' }}
          >
            <Text
              size="1"
              color="gray"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {leadName}
            </Text>
            <Avatar
              size="2"
              src={avatarUrl ?? undefined}
              fallback={initials}
              radius="full"
              style={{ flexShrink: 0 }}
            />
          </Flex>
        </>
      )}
    </div>
  )
}
