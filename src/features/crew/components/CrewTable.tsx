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
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { ArrowDown, ArrowUp, Search, Trash } from 'iconoir-react'
import { fuzzySearch } from '@shared/lib/generalFunctions'
import {
  crewIndexQuery,
  deleteInvite,
  pendingInvitesQuery,
} from '../api/queries'
import AddFreelancerDialog from './dialogs/AddFreelancerDialog'

type Props = {
  selectedUserId: string | null
  onSelect: (id: string) => void
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
  internalNotesByUserId?: Record<string, string>
}

type Row = {
  kind: 'employee' | 'freelancer' | 'invite' | 'owner'
  id: string
  title: string
  subtitle?: string
  role?: 'owner' | 'employee' | 'freelancer' | 'super_user'
  email: string
}

type SortColumn = 'name' | 'email' | 'status'
type SortDirection = 'asc' | 'desc'

const GRID_COLUMNS = 'minmax(180px, 2fr) minmax(120px, 1fr) 100px'

export default function CrewTable({
  selectedUserId,
  onSelect,
  showEmployees,
  showFreelancers,
  showMyPending,
  internalNotesByUserId,
}: Props) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [sortColumn, setSortColumn] = React.useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc')
  const { success } = useToast()

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

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

  const rows = React.useMemo(() => {
    const L: Array<Row> = []

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

    owners.forEach((u) =>
      L.push({
        kind: 'owner',
        id: u.user_id,
        title: u.display_name ?? u.email,
        subtitle: `${u.email} · owner`,
        email: u.email,
      }),
    )

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

    const filtered = search.trim()
      ? fuzzySearch(
          L,
          search,
          [(r) => r.title, (r) => r.subtitle ?? '', (r) => r.email],
          0.3,
        )
      : L

    const sorted = filtered.slice()
    if (sortColumn) {
      sorted.sort((a, b) => {
        let comparison = 0

        if (sortColumn === 'name') {
          comparison = a.title.localeCompare(b.title)
        } else if (sortColumn === 'email') {
          comparison = a.email.localeCompare(b.email)
        } else {
          const priority: Record<(typeof filtered)[number]['kind'], number> = {
            invite: 0,
            owner: 1,
            employee: 2,
            freelancer: 3,
          }
          comparison = priority[a.kind] - priority[b.kind]
          if (comparison === 0) {
            comparison = a.title.localeCompare(b.title)
          }
        }

        return sortDirection === 'asc' ? comparison : -comparison
      })
    } else {
      const priority: Record<(typeof filtered)[number]['kind'], number> = {
        invite: 0,
        owner: 1,
        employee: 2,
        freelancer: 3,
      }
      sorted.sort((a, b) => {
        const kindComparison = priority[a.kind] - priority[b.kind]
        return kindComparison !== 0
          ? kindComparison
          : a.title.localeCompare(b.title)
      })
    }

    return sorted
  }, [
    employees,
    freelancers,
    owners,
    myInvites,
    showEmployees,
    showFreelancers,
    showMyPending,
    search,
    sortColumn,
    sortDirection,
  ])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    enabled: rows.length > 0,
  })

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const [addOpen, setAddOpen] = React.useState(false)

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

  return (
    <Box
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div ref={controlsRef}>
        <Flex gap="2" align="center" wrap="wrap">
          <TextField.Root
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crew…"
            size="3"
            style={{ flex: '1 1 260px' }}
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

          <Button variant="classic" onClick={() => setAddOpen(true)}>
            Add freelancer
          </Button>

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
      </div>

      {/* Table header */}
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
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          <Flex align="center" gap="1">
            <Text>Name / Email</Text>
            {sortColumn === 'name' &&
              (sortDirection === 'asc' ? (
                <ArrowUp width={12} height={12} />
              ) : (
                <ArrowDown width={12} height={12} />
              ))}
          </Flex>
        </div>
        <div
          onClick={() => handleSort('status')}
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          <Flex align="center" gap="1">
            <Text>Status</Text>
            {sortColumn === 'status' &&
              (sortDirection === 'asc' ? (
                <ArrowUp width={12} height={12} />
              ) : (
                <ArrowDown width={12} height={12} />
              ))}
          </Flex>
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
            textAlign: 'right',
          }}
        />
      </div>

      {/* Virtualized list body */}
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
              const internalNote =
                r.kind !== 'invite' ? internalNotesByUserId?.[r.id] : undefined

              return (
                <div
                  key={r.id}
                  data-index={virtualRow.index}
                  onClick={() => r.kind !== 'invite' && onSelect(r.id)}
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
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <div>
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
                  </div>
                  <div style={{ verticalAlign: 'middle' }}>
                    {r.kind === 'invite' ? (
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
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {r.kind === 'invite' && (
                      <Button
                        variant="soft"
                        color="red"
                        size="1"
                        onClick={(e) => {
                          e.stopPropagation()
                          const id = r.id.replace('invite:', '')
                          delInvite.mutate(id)
                        }}
                        disabled={delInvite.isPending}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {rows.length} crew member{rows.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}
    </Box>
  )
}
