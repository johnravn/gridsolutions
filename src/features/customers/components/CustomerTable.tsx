import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  Select,
  Spinner,
  Table,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { InfoCircle, Search } from 'iconoir-react'
import { customersIndexQuery } from '../api/queries'
import AddCustomerDialog from './dialogs/AddCustomerDialog'

type CustomerTypeFilter = 'all' | 'customer' | 'partner'

export default function CustomerTable({
  selectedId,
  onSelect,
  showRegular,
  showPartner,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  showRegular: boolean
  showPartner: boolean
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [addOpen, setAddOpen] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const theadRef = React.useRef<HTMLTableSectionElement>(null)
  const pagerRef = React.useRef<HTMLDivElement>(null)

  // Initialize filter state based on props
  const [customerTypeFilter, setCustomerTypeFilter] =
    React.useState<CustomerTypeFilter>(() => {
      if (showRegular && showPartner) return 'all'
      if (showRegular && !showPartner) return 'customer'
      if (!showRegular && showPartner) return 'partner'
      return 'all'
    })

  // Derive showRegular/showPartner from filter state
  const derivedShowRegular =
    customerTypeFilter === 'all' || customerTypeFilter === 'customer'
  const derivedShowPartner =
    customerTypeFilter === 'all' || customerTypeFilter === 'partner'

  const {
    data: rows = [],
    isFetching,
    isLoading,
  } = useQuery({
    ...customersIndexQuery({
      companyId: companyId ?? '__none__',
      search: debouncedSearch,
      showRegular: derivedShowRegular,
      showPartner: derivedShowPartner,
    }),
    enabled: !!companyId,
    staleTime: 10_000,
  })

  // Recompute page size based on available space
  const recomputePageSize = React.useCallback(() => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const screenH = containerRect.height

    if (screenH === 0) return

    const controlsH = controlsRef.current?.offsetHeight ?? 0
    const theadH = theadRef.current?.offsetHeight ?? 0
    const pagerH = pagerRef.current?.offsetHeight ?? 0

    const miscPadding = 48 // Increased to account for pagination controls

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

    // Be conservative - don't add extra rows, and use floor to ensure we don't overflow
    const nextPageSize = Math.max(5, Math.min(50, Math.floor(available / rowH)))
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
    if (!isLoading && rows.length > 0) {
      requestAnimationFrame(() => {
        recomputePageSize()
      })
    }
  }, [isLoading, rows.length, recomputePageSize])

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1)
  }, [search, customerTypeFilter])

  // Paginate the rows
  const totalPages = Math.ceil(rows.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedRows = rows.slice(startIndex, endIndex)

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
            placeholder="Search customers…"
            size="3"
            style={{ flex: '1 1 260px' }}
          >
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
            <TextField.Slot side="right">
              {(isFetching || isLoading) && (
                <Flex align="center" gap="1">
                  <Text>Thinking</Text>
                  <Spinner size="2" />
                </Flex>
              )}
            </TextField.Slot>
          </TextField.Root>

          <Select.Root
            value={customerTypeFilter}
            size="3"
            onValueChange={(val) =>
              setCustomerTypeFilter(val as CustomerTypeFilter)
            }
          >
            <Select.Trigger
              placeholder="Filter type…"
              style={{ minHeight: 'var(--space-7)' }}
            />
            <Select.Content>
              <Select.Item value="all">All</Select.Item>
              <Select.Item value="customer">Customer</Select.Item>
              <Select.Item value="partner">Partner</Select.Item>
            </Select.Content>
          </Select.Root>

          <Button variant="classic" onClick={() => setAddOpen(true)}>
            Add customer
          </Button>

          <AddCustomerDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdded={() =>
              qc.invalidateQueries({
                queryKey: ['company', companyId, 'customers-index'],
              })
            }
          />
        </Flex>
      </div>

      <Box style={{ flex: 1, minHeight: 0 }}>
        <Table.Root variant="surface" style={{ marginTop: 16 }}>
          <Table.Header ref={theadRef}>
            <Table.Row>
              <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Address</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Flex gap={'1'}>
                  Type
                  <Tooltip content="Customer: normal customer, Partner: supplier & customer">
                    <InfoCircle width={'1em'} />
                  </Tooltip>
                </Flex>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {paginatedRows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={3}>No results</Table.Cell>
              </Table.Row>
            ) : (
              paginatedRows.map((r) => {
                const active = r.id === selectedId
                return (
                  <Table.Row
                    key={r.id}
                    onClick={() => onSelect(r.id)}
                    style={{
                      cursor: 'pointer',
                      background: active ? 'var(--accent-a3)' : undefined,
                    }}
                    data-state={active ? 'active' : undefined}
                  >
                    <Table.Cell>
                      <Text size="2" weight="medium">
                        {r.name}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {r.address || '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {r.is_partner ? (
                        <Badge variant="soft" color="green">
                          Partner
                        </Badge>
                      ) : (
                        <Badge variant="soft">Customer</Badge>
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
              {rows.length} customers
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
