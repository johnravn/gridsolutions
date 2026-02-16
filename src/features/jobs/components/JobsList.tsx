import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { ArrowDown, ArrowUp, Plus, Search } from 'iconoir-react'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { getInitials, makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { jobsIndexQuery } from '../api/queries'
import { getJobStatusColor } from '../utils/statusColors'
import { useJobCrewRoleIds } from '../hooks/useJobCrewRoleIds'
import JobDialog from './dialogs/JobDialog'
import type { JobListRow, JobStatus } from '../types'

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
  selectedId,
  onSelect,
  statusFilter,
  showOnlyArchived,
  selectedDate,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  statusFilter: JobStatus[]
  showOnlyArchived: boolean
  selectedDate: string
}) {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [sortBy, setSortBy] = React.useState<SortBy>('start_at')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [createOpen, setCreateOpen] = React.useState(false)

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
    estimateSize: () => 64,
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
          size="3"
          style={{ flex: '1 1 200px', minWidth: 140 }}
        >
          <TextField.Slot side="left">
            <Search width={16} height={16} />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner size="2" />}
          </TextField.Slot>
        </TextField.Root>
        {companyRole !== 'freelancer' && (
          <Button size="2" variant="classic" onClick={() => setCreateOpen(true)}>
            <Plus width={16} height={16} />
            New job
          </Button>
        )}
      </Flex>

      <JobDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId!}
        mode="create"
        onSaved={(id) => {
          onSelect(id)
          refetch()
        }}
      />

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
          onClick={() => handleSort('status')}
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            justifySelf: 'start',
          }}
          title="Click to sort"
        >
          Status
          {sortBy === 'status' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
        </div>
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
              const isSelected = job.id === selectedId
              const displayStatus = getDisplayStatus(job.status, companyRole)
              const myRole = getMyJobRole(job)
              const showCrewBadge = myRole === 'crew' || myRole === 'both'
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
                job.project_lead?.display_name ?? job.project_lead?.email ?? '',
              )
              const avatarUrl = getAvatarUrl(
                job.project_lead?.avatar_url ?? null,
              )

              return (
                <div
                  key={job.id}
                  data-index={virtualRow.index}
                  onClick={() => onSelect(job.id)}
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
                  <Box style={{ minWidth: 0 }}>
                    <Flex
                      gap="2"
                      align="center"
                      wrap="wrap"
                      style={{ minWidth: 0 }}
                    >
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
                      style={{ width: 'fit-content', whiteSpace: 'nowrap' }}
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
                </div>
              )
            })}
          </div>
        )}
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
