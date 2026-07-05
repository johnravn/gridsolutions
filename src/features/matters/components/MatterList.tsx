import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import {
  VirtualIndexTable,
  applySortDir,
  useClientSort,
  useClientTableFilter,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { mattersIndexQueryAll } from '../api/queries'
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
  'minmax(100px, 1fr) minmax(140px, 2fr) minmax(80px, 1fr) 44px minmax(100px, 1fr) 24px'

const COLUMNS: Array<IndexColumn<SortBy>> = [
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
  { id: 'unread', header: '' },
]

const SEARCH_FIELDS = [
  (m: Matter) => m.title,
  (m: Matter) => m.content,
  (m: Matter) => m.job?.title,
  (m: Matter) => m.created_by?.display_name,
  (m: Matter) => m.created_by?.email,
  (m: Matter) => (m.created_as_company ? m.company?.name : null),
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
  if (matter.matter_type === 'crew_invite') {
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
  companyFilter,
  typeFilter,
  companies: _companies,
  onCreateMatter,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  unreadFilter: boolean
  companyFilter: Array<string>
  typeFilter: Array<MatterType>
  companies: Array<{ id: string; name: string }>
  onCreateMatter?: () => void
}) {
  const { companyRole, isGlobalSuperuser } = useAuthz()
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
    ...mattersIndexQueryAll(),
  })

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

  return (
    <VirtualIndexTable
      rows={rows}
      columns={COLUMNS}
      gridTemplateColumns={GRID_COLUMNS}
      getRowId={(m) => m.id}
      renderCell={(matter, colId) => {
        const isSelected = matter.id === selectedId
        switch (colId) {
          case 'type':
            return (
              <Flex align="center" gap="2">
                {getTypeBadge(matter.matter_type)}
              </Flex>
            )
          case 'title':
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
                        weight={
                          isSelected || matter.is_unread ? 'bold' : 'medium'
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
          case 'unread':
            return (
              <Flex align="center" justify="end">
                {matter.is_unread && (
                  <Text size="1" color="blue" weight="medium">
                    New
                  </Text>
                )}
              </Flex>
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
      emptyMessage={
        allMatters.length === 0
          ? 'No matters yet'
          : 'No matters match your filters'
      }
      footerCount={{
        shown: rows.length,
        label: (n) => `${n} matter${n !== 1 ? 's' : ''}`,
      }}
      toolbar={
        <Flex
          gap="2"
          align="center"
          wrap="wrap"
          mb="2"
          direction={
            isMobile && onCreateMatter && canCreateAnnouncement
              ? 'column'
              : 'row'
          }
          justify={isMobile ? 'start' : 'between'}
        >
          <TextField.Root
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search matters…"
            size="3"
            style={{
              flex:
                isMobile && onCreateMatter && canCreateAnnouncement
                  ? undefined
                  : '1 1 260px',
              width: '100%',
            }}
          >
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
            <TextField.Slot side="right">
              {isFetching && <Spinner size="2" />}
            </TextField.Slot>
          </TextField.Root>
          {onCreateMatter && canCreateAnnouncement && (
            <Tooltip content="Send a manual announcement to selected people (uncommon)">
              <Button
                type="button"
                variant="ghost"
                size="1"
                color="gray"
                onClick={onCreateMatter}
                style={
                  isMobile
                    ? { alignSelf: 'flex-end' }
                    : { flexShrink: 0, alignSelf: 'center' }
                }
              >
                <Plus width={14} height={14} />
                New announcement
              </Button>
            </Tooltip>
          )}
        </Flex>
      }
    />
  )
}
