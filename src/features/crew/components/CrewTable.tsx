import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Plus, Search, Trash } from 'iconoir-react'
import {
  IndexTableBodySkeleton,
  VirtualIndexTable,
  useClientTableFilter,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import {
  INDEX_TABLE_ROW_CLASS,
  INDEX_TABLE_ROW_SELECTED_CLASS,
} from '@shared/ui/index-table/indexTableStyles'
import {
  buildCrewIndexRows,
  compareCrewIndexRows,
} from '../lib/buildCrewIndexRows'
import {
  crewIndexQuery,
  deleteInvite,
  pendingInvitesQuery,
} from '../api/queries'
import AddFreelancerDialog from './dialogs/AddFreelancerDialog'
import type {
  CrewIndexTableRow,
  CrewSortColumn,
} from '../lib/buildCrewIndexRows'
import type { IndexColumn } from '@shared/ui/index-table'

type Props = {
  selectedUserId: string | null
  onSelect: (id: string) => void
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
  internalNotesByUserId?: Record<string, string>
  createShortcutRef?: React.MutableRefObject<(() => void) | null>
  toolbarExtra?: React.ReactNode
}

const GRID_COLUMNS = 'minmax(180px, 2fr) minmax(120px, 1fr) 100px'
const PAGE_GRID_COLUMNS = 'minmax(0, 1fr) auto auto'

const SEARCH_FIELDS = [
  (r: CrewIndexTableRow) => r.title,
  (r: CrewIndexTableRow) => r.subtitle,
  (r: CrewIndexTableRow) => r.email,
]

export default function CrewTable({
  selectedUserId,
  onSelect,
  showEmployees,
  showFreelancers,
  showMyPending,
  internalNotesByUserId,
  createShortcutRef,
  toolbarExtra,
}: Props) {
  const { companyId } = useCompany()
  const { canWrite } = useCompanyWriteAccess()
  const qc = useQueryClient()
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const [search, setSearch] = React.useState('')
  const [sortColumn, setSortColumn] = React.useState<CrewSortColumn | null>(
    null,
  )
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>(
    'asc',
  )
  const { success } = useToast()

  const { data: employees = [], isLoading: empLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'employee' }),
    enabled: !!companyId && showEmployees,
  })

  const { data: freelancers = [], isLoading: frLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'freelancer' }),
    enabled: !!companyId && showFreelancers,
  })

  const { data: owners = [], isLoading: owLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'owner' }),
    enabled: !!companyId,
  })

  const { data: myInvites = [], isLoading: invLoading } = useQuery({
    ...pendingInvitesQuery({ companyId: companyId! }),
    enabled: !!companyId && showMyPending,
  })

  const baseRows = React.useMemo(
    () =>
      buildCrewIndexRows({
        employees,
        freelancers,
        owners,
        invites: myInvites,
        showEmployees,
        showFreelancers,
        showMyPending,
        ownersFirst: false,
      }),
    [
      employees,
      freelancers,
      owners,
      myInvites,
      showEmployees,
      showFreelancers,
      showMyPending,
    ],
  )

  const filtered = useClientTableFilter(baseRows, search, SEARCH_FIELDS)

  const rows = React.useMemo(
    () =>
      [...filtered].sort((a, b) =>
        compareCrewIndexRows(a, b, sortColumn, sortDirection),
      ),
    [filtered, sortColumn, sortDirection],
  )

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (r) => r.id,
    estimateRowSize: 52,
  })

  const handleSort = (column: CrewSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const [addOpen, setAddOpen] = React.useState(false)
  React.useEffect(() => {
    if (!createShortcutRef) return
    createShortcutRef.current = () => setAddOpen(true)
    return () => {
      createShortcutRef.current = null
    }
  }, [createShortcutRef])

  const delInvite = useMutation({
    mutationFn: (inviteId: string) => deleteInvite({ inviteId }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'pending-invites'],
      })
      success('Success', 'Invite successfully deleted')
    },
  })

  const isLoading = empLoading || frLoading || invLoading || owLoading

  const columns: Array<IndexColumn<CrewSortColumn>> = [
    { id: 'name', header: 'Name / Email', sortable: true, sortKey: 'name' },
    { id: 'status', header: 'Status', sortable: true, sortKey: 'status' },
  ]

  const renderNameCell = (r: CrewIndexTableRow) => {
    const internalNote =
      r.kind !== 'invite' ? internalNotesByUserId?.[r.id] : undefined
    return (
      <>
        <Text size="2" weight="medium">
          {r.title}
        </Text>
        {r.subtitle && (
          <Text as="div" size="1" color="gray">
            {r.subtitle}
          </Text>
        )}
        {internalNote && (
          <Text as="div" size="1" color="gray">
            <Text weight="medium">Internal:</Text> {internalNote}
          </Text>
        )}
      </>
    )
  }

  const renderStatusCell = (r: CrewIndexTableRow) =>
    r.kind === 'invite' ? (
      <Badge variant="soft" color="amber">
        Pending invite
      </Badge>
    ) : (
      <Badge
        variant="soft"
        color={
          r.kind === 'owner'
            ? 'purple'
            : r.kind === 'employee'
              ? 'blue'
              : 'green'
        }
      >
        {r.kind}
      </Badge>
    )

  const renderInviteAction = (r: CrewIndexTableRow) =>
    r.kind === 'invite' ? (
      <Button
        variant="soft"
        color="red"
        size="1"
        onClick={(e) => {
          e.stopPropagation()
          delInvite.mutate(r.id.replace('invite:', ''))
        }}
        disabled={delInvite.isPending}
      >
        <Trash width={14} height={14} />
      </Button>
    ) : null

  const toolbar = (
    <Flex
      gap={isMobile ? '4' : '2'}
      align="center"
      wrap="wrap"
      direction={isMobile ? 'column' : 'row'}
    >
      <Flex
        gap="3"
        align="center"
        style={{ width: isMobile ? '100%' : undefined, flex: 1, minWidth: 0 }}
      >
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search crew…"
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
            {isLoading && (
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner size="2" />
              </Flex>
            )}
          </TextField.Slot>
        </TextField.Root>
        {isMobile ? toolbarExtra : null}
      </Flex>

      {canWrite && (
        <Button
          variant="solid"
          onClick={() => setAddOpen(true)}
          style={isMobile ? { width: '100%' } : undefined}
          size="3"
        >
          <Plus width={18} height={18} />
          Add freelancer
        </Button>
      )}

      <AddFreelancerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => {
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'crew-index', 'freelancer'],
          })
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'pending-invites'],
          })
        }}
      />
    </Flex>
  )

  if (isMobile) {
    return (
      <Flex direction="column" gap="5" style={{ minWidth: 0 }}>
        <Box className="app-mobile-sticky-toolbar">{toolbar}</Box>
        {isLoading ? (
          <IndexTableBodySkeleton rowCount={8} rowHeight={64} />
        ) : rows.length === 0 ? (
          <Text size="2" color="gray">
            No results
          </Text>
        ) : (
          <Flex
            direction="column"
            gap="2"
            style={{
              paddingBottom:
                'calc(var(--app-menu-fab-clearance) + var(--space-5))',
            }}
          >
            {rows.map((r) => {
              const selectable = r.kind !== 'invite'
              const isSelected = selectable && r.id === selectedUserId
              return (
                <div
                  key={r.id}
                  className={[
                    INDEX_TABLE_ROW_CLASS,
                    isSelected ? INDEX_TABLE_ROW_SELECTED_CLASS : undefined,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role={selectable ? 'button' : undefined}
                  tabIndex={selectable ? 0 : undefined}
                  onClick={() => {
                    if (selectable) onSelect(r.id)
                  }}
                  onKeyDown={
                    selectable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelect(r.id)
                          }
                        }
                      : undefined
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns: PAGE_GRID_COLUMNS,
                    gap: 'var(--space-3)',
                    alignItems: 'center',
                    padding: '16px 12px',
                    minHeight: 64,
                    cursor: selectable ? 'pointer' : 'default',
                    borderRadius: 'var(--radius-3)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Flex direction="column" gap="1">
                      {renderNameCell(r)}
                    </Flex>
                  </div>
                  {renderStatusCell(r)}
                  <div style={{ textAlign: 'right' }}>
                    {renderInviteAction(r)}
                  </div>
                </div>
              )
            })}
          </Flex>
        )}
        {rows.length > 0 && (
          <Text size="2" color="gray">
            {rows.length} crew member{rows.length !== 1 ? 's' : ''}
          </Text>
        )}
      </Flex>
    )
  }

  return (
    <VirtualIndexTable
      rows={rows}
      columns={columns}
      gridTemplateColumns={GRID_COLUMNS}
      getRowId={(r) => r.id}
      renderCell={(r, colId) => {
        if (colId === 'name') return renderNameCell(r)
        if (colId === 'status') return renderStatusCell(r)
        return null
      }}
      selectedId={selectedUserId}
      onSelect={onSelect}
      isRowSelectable={(r) => r.kind !== 'invite'}
      sortBy={sortColumn ?? undefined}
      sortDir={sortDirection}
      onSort={handleSort}
      sortableColumns={['name', 'status']}
      sortIndicator="arrow"
      scrollRef={scrollRef}
      rowVirtualizer={rowVirtualizer}
      isLoading={isLoading}
      emptyMessage="No results"
      footerCount={{
        shown: rows.length,
        label: (n) => `${n} crew member${n !== 1 ? 's' : ''}`,
      }}
      renderRowActions={renderInviteAction}
      toolbar={toolbar}
    />
  )
}
