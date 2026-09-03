import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Checkbox,
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
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  MOBILE_LIST_BOTTOM_PAD,
  MobileBottomActionBar,
  MobilePageList,
} from '@app/layout/mobile'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import {
  IndexTableBodySkeleton,
  VirtualIndexTable,
  applySortDir,
  useClientSort,
  useClientTableFilter,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import {
  INDEX_TABLE_ROW_CLASS,
  INDEX_TABLE_ROW_SELECTED_CLASS,
} from '@shared/ui/index-table/indexTableStyles'
import { mattersIndexQueryAll } from '../api/queries'
import { useMatterReadMutations } from '../hooks/useMatterReadMutations'
import { crewInviteResponseKind } from '../utils/crewInviteResponse'
import {
  CrewInviteAnswerBadge,
  crewInviteAnswerStatus,
} from './CrewInviteAnswerStatus'
import { MattersInboxMenu } from './MattersInboxMenu'
import type { IndexColumn } from '@shared/ui/index-table'
import type { Matter, MatterType } from '../types'

const MONTH_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'mai',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'des',
]

function formatMatterDate(dateInput: string | Date): string {
  const d = new Date(dateInput)
  return `${d.getDate()}. ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

type SortBy = 'type' | 'title' | 'created' | 'response' | 'company'

const GRID_COLUMNS =
  '48px minmax(100px, 1fr) minmax(140px, 2fr) minmax(80px, 1fr) 44px minmax(100px, 1fr)'

const BASE_COLUMNS: Array<IndexColumn<SortBy>> = [
  { id: 'type', header: 'Type', sortable: true, sortKey: 'type' },
  { id: 'title', header: 'Title', sortable: true, sortKey: 'title' },
  { id: 'created', header: 'Created', sortable: true, sortKey: 'created' },
  {
    id: 'response',
    header: <ChatBubbleQuestion width={14} height={14} />,
    sortable: true,
    sortKey: 'response',
  },
  { id: 'company', header: 'Company', sortable: true, sortKey: 'company' },
]

const SEARCH_FIELDS = [
  (m: Matter) => m.title,
  (m: Matter) => m.content,
  (m: Matter) => m.job?.title,
  (m: Matter) => m.created_by?.display_name,
  (m: Matter) => m.created_by?.email,
  (m: Matter) => (m.created_as_company ? m.company?.name : null),
  (m: Matter) => m.answered_by?.display_name,
  (m: Matter) => m.answered_by?.email,
]

function compareMatters(
  a: Matter,
  b: Matter,
  sortBy: SortBy,
  sortDir: 'asc' | 'desc',
) {
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
        a.matter_type === 'crew_invite' && a.my_response ? 1 : 0
      const bHasResponse =
        b.matter_type === 'crew_invite' && b.my_response ? 1 : 0
      comparison = aHasResponse - bHasResponse
      break
    }
    case 'company':
      comparison = (a.company?.name || '').localeCompare(b.company?.name || '')
      break
  }
  return applySortDir(comparison, sortDir)
}

function getResponseIcon(matter: Matter) {
  const answerStatus = crewInviteAnswerStatus(matter.metadata)
  if (answerStatus) {
    return <CrewInviteAnswerBadge status={answerStatus} />
  }
  if (matter.matter_type === 'crew_invite') {
    if (matter.my_response) {
      const kind = crewInviteResponseKind(matter.my_response.response)
      if (kind === 'accepted') {
        return (
          <Badge radius="full" color="green" size="2" title="Accepted">
            <Check width={14} height={14} />
          </Badge>
        )
      }
      if (kind === 'declined') {
        return (
          <Badge radius="full" color="red" size="2" title="Declined">
            <Xmark width={14} height={14} />
          </Badge>
        )
      }
      if (kind === 'filled') {
        return (
          <Badge radius="full" color="amber" size="2" title="Role filled">
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

function getTypeBadge(type: Matter['matter_type']) {
  const variants: Record<string, { color: string; label: string }> = {
    crew_invite: { color: 'blue', label: 'Invite' },
    vote: { color: 'purple', label: 'Vote' },
    announcement: { color: 'gray', label: 'Announcement' },
    chat: { color: 'green', label: 'Chat' },
    update: { color: 'amber', label: 'Update' },
  }
  const v = variants[type] ?? variants.announcement
  return (
    <Badge
      radius="full"
      color={v.color as 'blue' | 'purple' | 'gray' | 'green' | 'amber'}
    >
      {v.label}
    </Badge>
  )
}

export default function MatterList({
  selectedId,
  onSelect,
  unreadFilter,
  onUnreadFilterChange,
  companyFilter,
  typeFilter,
  companies: _companies,
  onCreateMatter,
  toolbarExtra,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  unreadFilter: boolean
  onUnreadFilterChange: (v: boolean) => void
  companyFilter: Array<string>
  typeFilter: Array<MatterType>
  companies: Array<{ id: string; name: string }>
  onCreateMatter?: () => void
  toolbarExtra?: React.ReactNode
}) {
  const { companyRole, isGlobalSuperuser, userId } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const canCreateAnnouncement =
    canWrite &&
    (companyRole === 'owner' || companyRole === 'employee' || isGlobalSuperuser)
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const [search, setSearch] = React.useState('')
  const { sortBy, sortDir, handleSort } = useClientSort<SortBy>(
    'created',
    'desc',
  )

  const {
    data: allMatters = [],
    isLoading,
    isFetching,
  } = useQuery({
    ...mattersIndexQueryAll(userId),
  })
  const { markSelectedRead, markSelectedUnread, markAllRead } =
    useMatterReadMutations()
  const unreadCount = allMatters.filter((m) => m.is_unread).length
  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(
    () => new Set(),
  )

  const filteredBySearch = useClientTableFilter(
    allMatters,
    search,
    SEARCH_FIELDS,
  )

  const rows = React.useMemo(() => {
    let filtered = filteredBySearch

    if (typeFilter.length > 0) {
      filtered = filtered.filter((m) => typeFilter.includes(m.matter_type))
    }
    if (unreadFilter) {
      filtered = filtered.filter((m) => m.is_unread === true)
    }
    if (companyFilter.length > 0) {
      filtered = filtered.filter((m) => companyFilter.includes(m.company_id))
    }

    return [...filtered].sort((a, b) => compareMatters(a, b, sortBy, sortDir))
  }, [
    filteredBySearch,
    typeFilter,
    unreadFilter,
    companyFilter,
    sortBy,
    sortDir,
  ])

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (m) => m.id,
    estimateRowSize: 52,
  })

  const emptyMessage =
    allMatters.length === 0 ? 'No matters yet' : 'No matters match your filters'

  const selectableRows = React.useMemo(
    () => rows.filter((matter) => matter.is_recipient),
    [rows],
  )
  const visibleIdSet = React.useMemo(
    () => new Set(rows.map((matter) => matter.id)),
    [rows],
  )

  React.useEffect(() => {
    setCheckedIds((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visibleIdSet.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [visibleIdSet])

  const checkedMatters = React.useMemo(
    () => rows.filter((matter) => checkedIds.has(matter.id)),
    [rows, checkedIds],
  )
  const checkedUnreadCount = checkedMatters.filter(
    (matter) => matter.is_unread,
  ).length
  const checkedReadCount = checkedMatters.filter(
    (matter) => matter.is_recipient && !matter.is_unread,
  ).length
  const allSelectableChecked =
    selectableRows.length > 0 &&
    selectableRows.every((matter) => checkedIds.has(matter.id))
  const someSelectableChecked = selectableRows.some((matter) =>
    checkedIds.has(matter.id),
  )
  const headerChecked: boolean | 'indeterminate' = allSelectableChecked
    ? true
    : someSelectableChecked
      ? 'indeterminate'
      : false
  const bulkPending =
    markSelectedRead.isPending ||
    markSelectedUnread.isPending ||
    markAllRead.isPending

  const toggleChecked = React.useCallback((matterId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(matterId)) next.delete(matterId)
      else next.add(matterId)
      return next
    })
  }, [])

  const selectAllVisible = React.useCallback(() => {
    setCheckedIds(new Set(selectableRows.map((matter) => matter.id)))
  }, [selectableRows])

  const clearSelection = React.useCallback(() => {
    setCheckedIds(new Set())
  }, [])

  const inboxMenu = (
    <MattersInboxMenu
      visible={checkedMatters.length > 0}
      checkedCount={checkedMatters.length}
      checkedUnreadCount={checkedUnreadCount}
      checkedReadCount={checkedReadCount}
      unreadCount={unreadCount}
      unreadFilter={unreadFilter}
      pending={bulkPending}
      onMarkCheckedRead={() => {
        const ids = checkedMatters
          .filter((matter) => matter.is_unread)
          .map((matter) => matter.id)
        if (ids.length > 0) markSelectedRead.mutate(ids)
      }}
      onMarkCheckedUnread={() => {
        const ids = checkedMatters
          .filter((matter) => matter.is_recipient && !matter.is_unread)
          .map((matter) => matter.id)
        if (ids.length > 0) markSelectedUnread.mutate(ids)
      }}
      onShowUnread={() => onUnreadFilterChange(true)}
      onShowAll={() => onUnreadFilterChange(false)}
      onMarkAllUnreadAsRead={() => markAllRead.mutate()}
      onSelectAll={selectAllVisible}
      onClearSelection={clearSelection}
    />
  )

  const headerSelect = (
    <Flex
      align="center"
      justify="start"
      gap="0"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{ width: '100%', height: '100%' }}
    >
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          flexShrink: 0,
        }}
      >
        <Checkbox
          checked={headerChecked}
          disabled={selectableRows.length === 0}
          onCheckedChange={() => {
            if (allSelectableChecked) clearSelection()
            else selectAllVisible()
          }}
          aria-label="Select all visible matters"
        />
      </Box>
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          flexShrink: 0,
        }}
      >
        {inboxMenu}
      </Box>
    </Flex>
  )

  const renderCheckbox = (matter: Matter) => (
    <Flex
      align="center"
      justify="start"
      gap="0"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{ width: '100%', height: '100%' }}
    >
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          flexShrink: 0,
        }}
      >
        <Checkbox
          checked={checkedIds.has(matter.id)}
          disabled={!matter.is_recipient}
          onCheckedChange={() => {
            if (!matter.is_recipient) return
            toggleChecked(matter.id)
          }}
          aria-label={`Select ${matter.title}`}
        />
      </Box>
      <Box style={{ width: 18, flexShrink: 0 }} aria-hidden />
    </Flex>
  )

  const columns: Array<IndexColumn<SortBy>> = [
    {
      id: 'select',
      sortable: false,
      align: 'center',
      header: headerSelect,
    },
    ...BASE_COLUMNS,
  ]

  const createAnnouncementButton =
    onCreateMatter && canCreateAnnouncement && !isMobile ? (
      <Tooltip content="Send a manual announcement to selected people (uncommon)">
        <Button
          type="button"
          variant="ghost"
          size="3"
          color="gray"
          onClick={onCreateMatter}
          style={
            {
              flexShrink: 0,
              // Ghost buttons use negative margins for hover padding. Keep the
              // right-edge bleed (panel clip), but don't pull into the search field.
              '--margin-left': 'var(--button-ghost-padding-x)',
            } as React.CSSProperties
          }
        >
          <Plus width={18} height={18} />
          New announcement
        </Button>
      </Tooltip>
    ) : null

  const toolbar = (
    <Flex
      gap={isMobile ? '4' : '2'}
      align="center"
      wrap="wrap"
      mb={isMobile ? undefined : '2'}
      justify={isMobile ? 'start' : 'between'}
      // Room on the trailing edge for ghost hover (panel is overflow:hidden).
      style={isMobile ? undefined : { paddingRight: 'var(--space-3)' }}
    >
      <Flex
        gap="3"
        align="center"
        style={{ width: isMobile ? '100%' : undefined, flex: 1, minWidth: 0 }}
      >
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search matters…"
          size="3"
          style={{
            flex: isMobile ? 1 : '1 1 260px',
            width: '100%',
            minWidth: 0,
          }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner size="2" />}
          </TextField.Slot>
        </TextField.Root>
        {isMobile ? toolbarExtra : null}
      </Flex>
      {createAnnouncementButton}
    </Flex>
  )

  const renderTitle = (matter: Matter) => {
    const isSelected = matter.id === selectedId
    return (
      <Box style={{ minWidth: 0 }}>
        <Flex align="center" gap="2" style={{ minWidth: 0 }}>
          {matter.is_unread && (
            <Box
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--blue-9)',
                flexShrink: 0,
              }}
            />
          )}
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
                weight={isSelected || matter.is_unread ? 'bold' : 'medium'}
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
    )
  }

  if (isMobile) {
    return (
      <>
        <MobilePageList toolbar={toolbar}>
          {isLoading ? (
            <IndexTableBodySkeleton rowCount={8} rowHeight={64} />
          ) : rows.length === 0 ? (
            <Text size="2" color="gray">
              {emptyMessage}
            </Text>
          ) : (
            <Flex
              direction="column"
              gap="2"
              style={{ paddingBottom: MOBILE_LIST_BOTTOM_PAD }}
            >
              <Flex
                align="center"
                gap="2"
                style={{
                  padding: '4px 12px',
                  minHeight: 36,
                }}
              >
                {headerSelect}
              </Flex>
              {rows.map((matter) => {
                const isSelected = matter.id === selectedId
                return (
                  <div
                    key={matter.id}
                    className={[
                      INDEX_TABLE_ROW_CLASS,
                      isSelected ? INDEX_TABLE_ROW_SELECTED_CLASS : undefined,
                      matter.is_unread ? 'index-table-row--unread' : undefined,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(matter.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(matter.id)
                      }
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto auto minmax(0, 1fr) auto',
                      gap: 'var(--space-3)',
                      alignItems: 'center',
                      padding: '16px 12px',
                      minHeight: 64,
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-3)',
                    }}
                  >
                    {renderCheckbox(matter)}
                    {getTypeBadge(matter.matter_type)}
                    {renderTitle(matter)}
                    <Text size="1" color="gray">
                      {formatMatterDate(matter.created_at)}
                    </Text>
                  </div>
                )
              })}
            </Flex>
          )}
          {rows.length > 0 && (
            <Text size="2" color="gray">
              {rows.length} matter{rows.length !== 1 ? 's' : ''}
            </Text>
          )}
        </MobilePageList>
        {onCreateMatter && canCreateAnnouncement && (
          <MobileBottomActionBar>
            <Button
              type="button"
              variant="ghost"
              size="3"
              onClick={onCreateMatter}
            >
              <Plus width={18} height={18} />
              New announcement
            </Button>
          </MobileBottomActionBar>
        )}
      </>
    )
  }

  return (
    <VirtualIndexTable
      rows={rows}
      columns={columns}
      gridTemplateColumns={GRID_COLUMNS}
      getRowId={(m) => m.id}
      renderCell={(matter, colId) => {
        switch (colId) {
          case 'select':
            return renderCheckbox(matter)
          case 'type':
            return (
              <Flex align="center" gap="2">
                {getTypeBadge(matter.matter_type)}
              </Flex>
            )
          case 'title':
            return renderTitle(matter)
          case 'created':
            return (
              <Text size="2" color="gray">
                {formatMatterDate(matter.created_at)}
              </Text>
            )
          case 'response':
            return (
              getResponseIcon(matter) || (
                <Text size="2" color="gray">
                  —
                </Text>
              )
            )
          case 'company':
            return (
              <Text size="2" color="gray">
                {matter.company?.name || '—'}
              </Text>
            )
          default:
            return null
        }
      }}
      selectedId={selectedId}
      onSelect={(id) => onSelect(id)}
      getRowClassName={(matter) =>
        matter.is_unread ? 'index-table-row--unread' : undefined
      }
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={handleSort}
      sortableColumns={['type', 'title', 'created', 'response', 'company']}
      scrollRef={scrollRef}
      rowVirtualizer={rowVirtualizer}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      footerCount={{
        shown: rows.length,
        label: (n) => `${n} matter${n !== 1 ? 's' : ''}`,
      }}
      toolbar={toolbar}
    />
  )
}
