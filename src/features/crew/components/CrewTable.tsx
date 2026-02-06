import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
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
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const { success } = useToast()

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const theadRef = React.useRef<HTMLTableSectionElement>(null)
  const pagerRef = React.useRef<HTMLDivElement>(null)

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
    enabled: !!companyId && true,
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

    // Use fuzzy search for better matching
    const filtered = search.trim()
      ? fuzzySearch(
          L,
          search,
          [(r) => r.title, (r) => r.subtitle ?? '', (r) => r.email],
          0.3,
        )
      : L

    // Apply sorting
    const sorted = filtered.slice()
    if (sortColumn) {
      sorted.sort((a, b) => {
        let comparison = 0

        if (sortColumn === 'name') {
          comparison = a.title.localeCompare(b.title)
        } else if (sortColumn === 'email') {
          comparison = a.email.localeCompare(b.email)
        } else {
          // sortColumn === 'status'
          const priority: Record<(typeof filtered)[number]['kind'], number> = {
            invite: 0,
            owner: 1,
            employee: 2,
            freelancer: 3,
          }
          comparison = priority[a.kind] - priority[b.kind]
          // If same kind, tie-break by title
          if (comparison === 0) {
            comparison = a.title.localeCompare(b.title)
          }
        }

        return sortDirection === 'asc' ? comparison : -comparison
      })
    } else {
      // Default sort: Put invites first; then owner, employee, freelancer. Tie-break by title.
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

  // Recompute page size based on available space
  const recomputePageSize = React.useCallback(() => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const screenH = containerRect.height

    if (screenH === 0) return

    const controlsH = controlsRef.current?.offsetHeight ?? 0
    const theadH = theadRef.current?.offsetHeight ?? 0
    const pagerH = pagerRef.current?.offsetHeight ?? 0

    const miscPadding = 40 // Slightly reduced to allow one more row

    const available = Math.max(
      0,
      screenH - controlsH - theadH - pagerH - miscPadding,
    )

    if (available < 100) {
      setPageSize(5)
      return
    }

    const visibleRow = containerRef.current.querySelector<HTMLTableRowElement>(
      'tbody tr:not([data-row-probe])',
    )
    const rowH = visibleRow?.getBoundingClientRect().height || 60

    // Allow one more row for crew table
    const nextPageSize = Math.max(5, Math.min(50, Math.floor(available / rowH) + 1))
    setPageSize(nextPageSize)
  }, [])

  React.useEffect(() => {
    if (!containerRef.current) return

    const onResize = () => recomputePageSize()
    window.addEventListener('resize', onResize)

    const resizeObserver = new ResizeObserver(() => {
      recomputePageSize()
    })

    resizeObserver.observe(containerRef.current)

    const timeoutId = setTimeout(() => {
      recomputePageSize()
    }, 0)

    const rafId = requestAnimationFrame(() => {
      recomputePageSize()
    })

    return () => {
      window.removeEventListener('resize', onResize)
      resizeObserver.disconnect()
      clearTimeout(timeoutId)
      cancelAnimationFrame(rafId)
    }
  }, [recomputePageSize])

  React.useEffect(() => {
    if (
      !empLoading &&
      !frLoading &&
      !invLoading &&
      !owLoading &&
      rows.length > 0
    ) {
      requestAnimationFrame(() => {
        recomputePageSize()
      })
    }
  }, [
    empLoading,
    frLoading,
    invLoading,
    owLoading,
    rows.length,
    recomputePageSize,
  ])

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1)
  }, [
    search,
    sortColumn,
    sortDirection,
    showEmployees,
    showFreelancers,
    showMyPending,
  ])

  // Paginate the rows
  const totalPages = Math.ceil(rows.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedRows = rows.slice(startIndex, endIndex)

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
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

  return (
    <Box
      ref={containerRef}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
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
              {(empLoading || frLoading || invLoading || owLoading) && (
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
              // refresh lists
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

      <Box style={{ flex: 1, minHeight: 0 }}>
        <Table.Root variant="surface" style={{ marginTop: 16 }}>
          <Table.Header ref={theadRef}>
            <Table.Row>
              <Table.ColumnHeaderCell
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('name')}
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
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('status')}
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
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell
                style={{ width: 120, textAlign: 'right' }}
              />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {paginatedRows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={3}>No results</Table.Cell>
              </Table.Row>
            ) : (
              paginatedRows.map((r) => {
                const active = r.kind !== 'invite' && r.id === selectedUserId
                const internalNote =
                  r.kind !== 'invite' ? internalNotesByUserId?.[r.id] : undefined
                return (
                  <Table.Row
                    key={r.id}
                    onClick={() => r.kind !== 'invite' && onSelect(r.id)}
                    style={{
                      cursor: r.kind !== 'invite' ? 'pointer' : 'default',
                      background: active ? 'var(--accent-a3)' : undefined,
                    }}
                    data-state={active ? 'active' : undefined}
                  >
                    <Table.Cell>
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
                    </Table.Cell>
                    <Table.Cell style={{ verticalAlign: 'middle' }}>
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
                    </Table.Cell>
                    <Table.Cell style={{ textAlign: 'right' }}>
                      {r.kind === 'invite' && (
                        <Button
                          variant="soft"
                          color="red"
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
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
            {/* Probe row for height measurement */}
            <Table.Row
              data-row-probe
              style={{
                display: 'none',
              }}
            >
              <Table.Cell colSpan={3}>probe</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </Box>

      {rows.length > 0 && (
        <div ref={pagerRef}>
          <Flex align="center" justify="between" mt="3">
            <Text size="2" color="gray">
              Showing {startIndex + 1}-{Math.min(endIndex, rows.length)} of{' '}
              {rows.length} crew members
            </Text>
            <Flex gap="2">
              <Button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                variant="classic"
                size="2"
              >
                Prev
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                variant="classic"
                size="2"
              >
                Next
              </Button>
            </Flex>
          </Flex>
        </div>
      )}
    </Box>
  )
}
