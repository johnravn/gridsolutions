import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Flex, Spinner, Text, TextField } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Plus, Search, Trash } from 'iconoir-react'
import {
  VirtualIndexTable,
  useClientTableFilter,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
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
}

const GRID_COLUMNS = 'minmax(180px, 2fr) minmax(120px, 1fr) 100px'

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

  return (
    <VirtualIndexTable
      rows={rows}
      columns={columns}
      gridTemplateColumns={GRID_COLUMNS}
      getRowId={(r) => r.id}
      renderCell={(r, colId) => {
        if (colId === 'name') {
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
        if (colId === 'status') {
          return r.kind === 'invite' ? (
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
        }
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
      renderRowActions={(r) =>
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
      }
      toolbar={
        <Flex
          gap="2"
          align="center"
          wrap="wrap"
          direction={isMobile ? 'column' : 'row'}
        >
          <TextField.Root
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crew…"
            size="3"
            style={{ flex: isMobile ? undefined : '1 1 260px', width: '100%' }}
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

          {canWrite && (
            <Button
              variant="solid"
              onClick={() => setAddOpen(true)}
              style={isMobile ? { width: '100%' } : undefined}
              size={isMobile ? '3' : '2'}
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
      }
    />
  )
}
