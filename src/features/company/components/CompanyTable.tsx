// src/features/company/components/CompanyTable.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Flex,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Search, Trash } from 'iconoir-react'
import {
  VirtualIndexTable,
  useClientSort,
  useClientTableFilter,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import {
  buildCrewIndexRows,
  compareCompanyCrewRows,
} from '../../crew/lib/buildCrewIndexRows'
import {
  crewIndexQuery,
  deleteInvite,
  pendingInvitesQuery,
} from '../../crew/api/queries'
import AddFreelancerDialog from '../../crew/components/dialogs/AddFreelancerDialog'
import AddEmployeeDialog from './dialogs/AddEmployeeDialog'
import RemoveUserConfirmDialog from './dialogs/RemoveUserConfirmDialog'
import type {
  CompanyCrewSortBy,
  CrewIndexTableRow,
} from '../../crew/lib/buildCrewIndexRows'
import type { IndexColumn } from '@shared/ui/index-table'

const GRID_COLUMNS = 'minmax(160px, 2fr) minmax(120px, 1fr) 80px'

const SEARCH_FIELDS = [
  (r: CrewIndexTableRow) => r.title,
  (r: CrewIndexTableRow) => r.subtitle,
  (r: CrewIndexTableRow) => r.email,
]

const COLUMNS: Array<IndexColumn<CompanyCrewSortBy>> = [
  { id: 'name', header: 'Name / Email', sortable: true, sortKey: 'name' },
  { id: 'status', header: 'Status', sortable: true, sortKey: 'status' },
]

function roleColor(
  role: CrewIndexTableRow['role'] | CrewIndexTableRow['kind'],
) {
  return role === 'owner'
    ? 'purple'
    : role === 'employee'
      ? 'blue'
      : role === 'freelancer'
        ? 'green'
        : 'amber'
}

export default function CompanyTable({
  selectedUserId,
  onSelectUser,
  showEmployees,
  showFreelancers,
  showMyPending,
}: {
  selectedUserId: string | null
  onSelectUser: (id: string) => void
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const { sortBy, sortDir, handleSort } = useClientSort<CompanyCrewSortBy>(
    'name',
    'asc',
  )
  const { success } = useToast()

  const { data: owners = [], isLoading: owLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'owner' }),
    enabled: !!companyId,
  })

  const { data: employees = [], isLoading: empLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'employee' }),
    enabled: !!companyId && showEmployees,
  })

  const { data: freelancers = [] } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'freelancer' }),
    enabled: !!companyId && showFreelancers,
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
        ownersFirst: true,
      }),
    [
      owners,
      employees,
      freelancers,
      myInvites,
      showEmployees,
      showFreelancers,
      showMyPending,
    ],
  )

  const isLoading = empLoading || invLoading || owLoading

  const filtered = useClientTableFilter(baseRows, search, SEARCH_FIELDS)

  const rows = React.useMemo(
    () =>
      [...filtered].sort((a, b) =>
        compareCompanyCrewRows(a, b, sortBy, sortDir),
      ),
    [filtered, sortBy, sortDir],
  )

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (r) => r.id,
    estimateRowSize: 52,
  })

  const [addEmployeeOpen, setAddEmployeeOpen] = React.useState(false)
  const [addFreelancerOpen, setAddFreelancerOpen] = React.useState(false)
  const [removeUserOpen, setRemoveUserOpen] = React.useState(false)
  const [userToRemove, setUserToRemove] = React.useState<{
    id: string
    name: string
    email: string
    kind: 'employee' | 'freelancer'
  } | null>(null)
  const [inviteToRevoke, setInviteToRevoke] = React.useState<{
    id: string
    email: string
  } | null>(null)

  const delInvite = useMutation({
    mutationFn: (inviteId: string) => deleteInvite({ inviteId }),
    onSuccess: () => {
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'company' &&
          q.queryKey[1] === companyId &&
          q.queryKey[2] === 'pending-invites',
      })
      success('Success', 'Invite successfully deleted')
    },
  })

  return (
    <>
      <VirtualIndexTable
        rows={rows}
        columns={COLUMNS}
        gridTemplateColumns={GRID_COLUMNS}
        getRowId={(r) => r.id}
        renderCell={(r, colId) => {
          if (colId === 'name') {
            return (
              <Box>
                <Text size="2" weight="medium">
                  {r.title}
                </Text>
                {r.subtitle && (
                  <Text as="div" size="1" color="gray">
                    {r.subtitle}
                  </Text>
                )}
              </Box>
            )
          }
          if (colId === 'status') {
            return r.kind === 'invite' ? (
              <Flex gap="2" align="center">
                <Badge variant="soft" color="amber">
                  Pending invite
                </Badge>
                {r.role && (
                  <Badge variant="soft" color={roleColor(r.role)}>
                    {r.role === 'super_user' ? 'super user' : r.role}
                  </Badge>
                )}
              </Flex>
            ) : (
              <Badge variant="soft" color={roleColor(r.kind)}>
                {r.kind}
              </Badge>
            )
          }
          return null
        }}
        selectedId={selectedUserId}
        onSelect={onSelectUser}
        isRowSelectable={(r) => r.kind !== 'invite'}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        sortableColumns={['name', 'status']}
        scrollRef={scrollRef}
        rowVirtualizer={rowVirtualizer}
        isLoading={isLoading}
        emptyMessage="No results"
        footerCount={{
          shown: rows.length,
          label: (n) => `${n} user${n !== 1 ? 's' : ''}`,
        }}
        horizontalScroll
        renderRowActions={(r) => {
          if (r.kind === 'invite') {
            return (
              <Button
                variant="soft"
                color="red"
                onClick={(e) => {
                  e.stopPropagation()
                  setInviteToRevoke({
                    id: r.id.replace('invite:', ''),
                    email: r.title,
                  })
                }}
                disabled={delInvite.isPending}
              >
                <Trash width={14} height={14} />
              </Button>
            )
          }
          if (r.kind === 'employee' || r.kind === 'freelancer') {
            return (
              <Button
                variant="soft"
                color="red"
                onClick={(e) => {
                  e.stopPropagation()
                  setUserToRemove({
                    id: r.id,
                    name: r.title,
                    email: r.email ?? '',
                    kind: r.kind as 'employee' | 'freelancer',
                  })
                  setRemoveUserOpen(true)
                }}
              >
                <Trash width={14} height={14} />
              </Button>
            )
          }
          return null
        }}
        toolbar={
          <Flex gap="2" align="center" wrap="wrap">
            <TextField.Root
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              size="3"
              style={{ flex: '1 1 260px' }}
            >
              <TextField.Slot side="left">
                <Search />
              </TextField.Slot>
              <TextField.Slot side="right">
                {(empLoading || invLoading || owLoading) && (
                  <Flex align="center" gap="1">
                    <Spinner size="2" />
                  </Flex>
                )}
              </TextField.Slot>
            </TextField.Root>
            <Button variant="solid" onClick={() => setAddEmployeeOpen(true)}>
              Add employee
            </Button>
            <Button variant="soft" onClick={() => setAddFreelancerOpen(true)}>
              Add freelancer
            </Button>
          </Flex>
        }
      />

      <AddEmployeeDialog
        open={addEmployeeOpen}
        onOpenChange={setAddEmployeeOpen}
        onAdded={() => {
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'crew-index', 'employee'],
          })
          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              q.queryKey[0] === 'company' &&
              q.queryKey[1] === companyId &&
              q.queryKey[2] === 'pending-invites',
          })
        }}
      />
      <AddFreelancerDialog
        open={addFreelancerOpen}
        onOpenChange={setAddFreelancerOpen}
        onAdded={() => {
          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              q.queryKey[0] === 'company' &&
              q.queryKey[1] === companyId &&
              q.queryKey[2] === 'pending-invites',
          })
        }}
      />
      <RemoveUserConfirmDialog
        open={removeUserOpen}
        onOpenChange={setRemoveUserOpen}
        onRemoved={() => {}}
        userName={userToRemove?.name ?? ''}
        userEmail={userToRemove?.email ?? ''}
        userKind={userToRemove?.kind ?? 'employee'}
        userId={userToRemove?.id ?? ''}
      />

      <AlertDialog.Root
        open={!!inviteToRevoke}
        onOpenChange={(next) => {
          if (!next) setInviteToRevoke(null)
        }}
      >
        <AlertDialog.Content maxWidth="460px">
          <AlertDialog.Title>Revoke invite?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will cancel the pending invitation to{' '}
            <Text weight="medium">{inviteToRevoke?.email ?? ''}</Text>. They
            will not be able to join using the old link.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft" disabled={delInvite.isPending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                variant="solid"
                disabled={delInvite.isPending || !inviteToRevoke}
                onClick={() => {
                  if (!inviteToRevoke || delInvite.isPending) return
                  delInvite.mutate(inviteToRevoke.id, {
                    onSettled: () => setInviteToRevoke(null),
                  })
                }}
              >
                {delInvite.isPending ? 'Revoking…' : 'Yes, revoke invite'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  )
}
