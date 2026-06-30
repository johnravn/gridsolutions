import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Plus, Search } from 'iconoir-react'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { getInitials, makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { jobDetailQuery, jobsIndexQuery } from '../api/queries'
import { recurringJobsIndexQuery } from '../api/recurringJobQueries'
import { useAutoUpdateJobsListJobStatuses } from '../hooks/useAutoUpdateJobsListJobStatuses'
import { getJobStatusColor } from '../utils/statusColors'
import { useJobCrewRoleIds } from '../hooks/useJobCrewRoleIds'
import JobDialog from './dialogs/JobDialog'
import RecurringJobDialog from './dialogs/RecurringJobDialog'
import RecurringJobListRow from './RecurringJobListRow'
import type { JobListRow, JobStatus, JobsPageSelection } from '../types'

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

export default function JobsList({
  selection,
  onSelectJob,
  onSelectRecurringJob,
  statusFilter,
  showOnlyArchived,
  selectedDate,
  compact = false,
}: {
  selection: JobsPageSelection
  onSelectJob: (id: string | null) => void
  onSelectRecurringJob: (id: string | null) => void
  statusFilter: Array<JobStatus>
  showOnlyArchived: boolean
  selectedDate: string
  /** When true, use a stacked card layout for better mobile display */
  compact?: boolean
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { userId, companyRole } = useAuthz()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [sortBy, setSortBy] = React.useState<SortBy>('start_at')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createRecurringOpen, setCreateRecurringOpen] = React.useState(false)

  const selectedJobId = selection?.kind === 'job' ? selection.id : null
  const selectedRecurringJobId =
    selection?.kind === 'recurring_job' ? selection.id : null

  const scrollRef = React.useRef<HTMLDivElement>(null)

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
      showOnlyArchived,
    }),
    enabled: !!companyId,
  })

  useAutoUpdateJobsListJobStatuses(allData, !!companyId)

  const selectedJobDetail = useQuery({
    ...jobDetailQuery({ jobId: selectedJobId ?? '__none__' }),
    enabled: !!companyId && !!selectedJobId,
  })

  const { data: pinnedRecurringJobs = [] } = useQuery({
    ...recurringJobsIndexQuery({
      companyId: companyId ?? '__none__',
      projectLeadUserId: userId,
      includeArchived: false,
    }),
    enabled: !!companyId && !!userId && companyRole !== 'freelancer',
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
  }, [
    allData,
    companyId,
    qc,
    selectedJobId,
    selectedJobDetail.data,
    selectedJobDetail.dataUpdatedAt,
  ])

  const rows = React.useMemo(() => {
    let filtered = allData
    if (statusFilter.length > 0) {
      filtered = filtered.filter((j) => statusFilter.includes(j.status))
    }
    return filtered
  }, [allData, statusFilter])

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

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (compact ? 88 : 64),
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    enabled: rows.length > 0,
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

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex gap="2" align="center" wrap="wrap" mb="2">
        <TextField.Root
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size={compact ? '4' : '3'}
          style={
            compact
              ? { width: '100%' }
              : { flex: '1 1 200px', minWidth: 140 }
          }
        >
          <TextField.Slot side="left">
            <Search width={compact ? 20 : 16} height={compact ? 20 : 16} />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner size={compact ? '3' : '2'} />}
          </TextField.Slot>
        </TextField.Root>
        {companyRole !== 'freelancer' &&
          (compact ? (
            <Flex direction="column" gap="2" style={{ width: '100%' }}>
              <Button
                variant="solid"
                size="3"
                onClick={() => setCreateOpen(true)}
                style={{ width: '100%' }}
              >
                <Plus width={18} height={18} />
                New job
              </Button>
              <Button
                variant="soft"
                size="3"
                onClick={() => setCreateRecurringOpen(true)}
                style={{ width: '100%' }}
              >
                <Plus width={18} height={18} />
                New recurring job
              </Button>
            </Flex>
          ) : (
            <>
              <Button
                variant="solid"
                size="2"
                onClick={() => setCreateOpen(true)}
              >
                <Plus width={18} height={18} />
                New job
              </Button>
              <Button
                variant="soft"
                size="2"
                onClick={() => setCreateRecurringOpen(true)}
              >
                <Plus width={18} height={18} />
                New recurring job
              </Button>
            </>
          ))}
      </Flex>

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

      {pinnedRecurringJobs.length > 0 && (
        <Box mb="2">
          <Text size="1" weight="medium" color="gray" mb="1">
            Your recurring jobs
          </Text>
          {pinnedRecurringJobs.map((row) => (
            <RecurringJobListRow
              key={row.id}
              row={row}
              compact={compact}
              isSelected={selectedRecurringJobId === row.id}
              onClick={() => onSelectRecurringJob(row.id)}
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
            {searchRecurringHits.length > 0 && (
              <Box mb="2">
                {searchRecurringHits.map((row) => (
                  <RecurringJobListRow
                    key={row.id}
                    row={row}
                    compact={compact}
                    isSelected={selectedRecurringJobId === row.id}
                    onClick={() => onSelectRecurringJob(row.id)}
                  />
                ))}
              </Box>
            )}
            {rows.length === 0 && searchRecurringHits.length === 0 ? (
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
                      onClick={() => onSelectJob(job.id)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        display: compact ? 'block' : 'grid',
                        gridTemplateColumns: compact ? undefined : GRID_COLUMNS,
                        gap: compact ? undefined : 'var(--space-2)',
                        alignItems: 'center',
                        padding: compact
                          ? 'var(--space-3)'
                          : '0 var(--space-3)',
                        cursor: 'pointer',
                        backgroundColor: isSelected
                          ? 'var(--accent-a3)'
                          : compact
                            ? 'var(--gray-a2)'
                            : 'transparent',
                        borderRadius: compact
                          ? 'var(--radius-3)'
                          : 'var(--radius-2)',
                        marginBottom: 0,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor =
                            'var(--gray-a2)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = compact
                            ? 'var(--gray-a2)'
                            : 'transparent'
                        }
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
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {rows.length} job{rows.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}
    </div>
  )
}
