// src/features/company/components/CompanyTable.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
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
  crewIndexQuery,
  deleteInvite,
  pendingInvitesQuery,
} from '../../crew/api/queries'
import AddFreelancerDialog from '../../crew/components/dialogs/AddFreelancerDialog'
import AddEmployeeDialog from './dialogs/AddEmployeeDialog'
import RemoveUserConfirmDialog from './dialogs/RemoveUserConfirmDialog'

type Row = {
  kind: 'employee' | 'freelancer' | 'invite' | 'owner'
  id: string
  title: string
  subtitle?: string
  role?: 'owner' | 'employee' | 'freelancer' | 'super_user'
  email?: string
}

type SortBy = 'name' | 'status'
type SortDir = 'asc' | 'desc'

const GRID_COLUMNS = 'minmax(160px, 2fr) minmax(120px, 1fr) 80px'

const KIND_ORDER: Record<Row['kind'], number> = {
  invite: 0,
  owner: 1,
  employee: 2,
  freelancer: 3,
}

function compareRows(a: Row, b: Row, sortBy: SortBy, sortDir: SortDir): number {
  let cmp = 0
  if (sortBy === 'name') {
    cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  } else {
    cmp = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (cmp === 0) cmp = a.title.localeCompare(b.title)
  }
  return sortDir === 'asc' ? cmp : -cmp
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
  const [sortBy, setSortBy] = React.useState<SortBy>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const { success } = useToast()

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

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

  const rows = React.useMemo(() => {
    const L: Array<Row> = []
    owners.forEach((u) =>
      L.push({
        kind: 'owner',
        id: u.user_id,
        title: u.display_name ?? u.email,
        subtitle: `${u.email} · owner`,
        email: u.email,
      }),
    )
    if (showEmployees) {
      employees.forEach((u) =>
        L.push({
          kind: 'employee',
          id: u.user_id,
          title: u.display_name ?? u.email,
          subtitle: `${u.email} · employee`,
          email: u.email,
        }),
      )
    }
    if (showFreelancers) {
      freelancers.forEach((u) =>
        L.push({
          kind: 'freelancer',
          id: u.user_id,
          title: u.display_name ?? u.email,
          subtitle: `${u.email} · freelancer`,
          email: u.email,
        }),
      )
    }
    if (showMyPending) {
      myInvites.forEach((i) =>
        L.push({
          kind: 'invite',
          id: `invite:${i.id}`,
          title: i.email,
          subtitle: `${i.role} · expires ${new Date(i.expires_at).toLocaleDateString()}`,
          role: i.role as Row['role'],
          email: i.email,
        }),
      )
    }
    const term = search.trim().toLowerCase()
    const filtered = term
      ? L.filter(
          (r) =>
            r.title.toLowerCase().includes(term) ||
            (r.subtitle ?? '').toLowerCase().includes(term),
        )
      : L
    return [...filtered].sort((a, b) => compareRows(a, b, sortBy, sortDir))
  }, [
    owners,
    employees,
    freelancers,
    myInvites,
    showEmployees,
    showFreelancers,
    showMyPending,
    search,
    sortBy,
    sortDir,
  ])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    enabled: rows.length > 0,
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

  const handleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  const roleColor = (role: Row['role'] | Row['kind']) =>
    role === 'owner'
      ? 'purple'
      : role === 'employee'
        ? 'blue'
        : role === 'freelancer'
          ? 'green'
          : 'amber'

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex ref={controlsRef} gap="2" align="center" wrap="wrap">
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
        <Button variant="classic" onClick={() => setAddEmployeeOpen(true)}>
          Add employee
        </Button>
        <Button variant="soft" onClick={() => setAddFreelancerOpen(true)}>
          Add freelancer
        </Button>
      </Flex>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS,
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--gray-a2)',
          borderRadius: 'var(--radius-2)',
          marginTop: 16,
          flexShrink: 0,
        }}
      >
        <div
          onClick={() => handleSort('name')}
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Click to sort"
        >
          Name / Email{sortBy === 'name' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
        </div>
        <div
          onClick={() => handleSort('status')}
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Click to sort"
        >
          Status{sortBy === 'status' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
        </div>
        <div style={{ fontSize: 'var(--font-size-1)', fontWeight: 600 }} />
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
              No results
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
              const r = rows[virtualRow.index]
              const active = r.kind !== 'invite' && r.id === selectedUserId

              return (
                <div
                  key={r.id}
                  data-index={virtualRow.index}
                  onClick={() => r.kind !== 'invite' && onSelectUser(r.id)}
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
                    cursor: r.kind !== 'invite' ? 'pointer' : 'default',
                    backgroundColor: active ? 'var(--accent-a3)' : 'transparent',
                    borderRadius: 'var(--radius-2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!active && r.kind !== 'invite') {
                      e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
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
                  <Box>
                    {r.kind === 'invite' ? (
                      <Flex gap="2" align="center">
                        <Badge variant="soft" color="amber">
                          Pending invite
                        </Badge>
                        {r.role && (
                          <Badge
                            variant="soft"
                            color={
                              r.role === 'owner'
                                ? 'purple'
                                : r.role === 'employee'
                                  ? 'blue'
                                  : r.role === 'freelancer'
                                    ? 'green'
                                    : 'amber'
                            }
                          >
                            {r.role === 'super_user' ? 'super user' : r.role}
                          </Badge>
                        )}
                      </Flex>
                    ) : (
                      <Badge variant="soft" color={roleColor(r.kind)}>
                        {r.kind}
                      </Badge>
                    )}
                  </Box>
                  <Box style={{ textAlign: 'right' }}>
                    {r.kind === 'invite' && (
                      <Button
                        variant="soft"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation()
                          delInvite.mutate(r.id.replace('invite:', ''))
                        }}
                        disabled={delInvite.isPending}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    )}
                    {(r.kind === 'employee' || r.kind === 'freelancer') && (
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
                    )}
                  </Box>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {rows.length} user{rows.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}

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
    </div>
  )
}
