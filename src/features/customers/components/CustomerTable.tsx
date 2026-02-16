import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  Select,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { InfoCircle, Search } from 'iconoir-react'
import { customersIndexQuery } from '../api/queries'
import AddCustomerDialog from './dialogs/AddCustomerDialog'

type CustomerTypeFilter = 'all' | 'customer' | 'partner'

const GRID_COLUMNS = 'minmax(180px, 2fr) 120px'

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

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const [customerTypeFilter, setCustomerTypeFilter] =
    React.useState<CustomerTypeFilter>(() => {
      if (showRegular && showPartner) return 'all'
      if (showRegular && !showPartner) return 'customer'
      if (!showRegular && showPartner) return 'partner'
      return 'all'
    })

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

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    enabled: rows.length > 0,
  })

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
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          Name
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          <Flex gap="1" align="center">
            Type
            <Tooltip content="Customer: normal customer, Partner: supplier & customer">
              <InfoCircle width="1em" height="1em" />
            </Tooltip>
          </Flex>
        </div>
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
        {isLoading ? (
          <Flex align="center" justify="center" py="6">
            <Spinner size="2" />
          </Flex>
        ) : rows.length === 0 ? (
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

              const active = r.id === selectedId

              return (
                <div
                  key={r.id}
                  data-index={virtualRow.index}
                  onClick={() => onSelect(r.id)}
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
                      {r.name}
                    </Text>
                  </div>
                  <div>
                    {r.is_partner ? (
                      <Badge variant="soft" color="green">
                        Partner
                      </Badge>
                    ) : (
                      <Badge variant="soft">Customer</Badge>
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
            {rows.length} customer{rows.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}
    </Box>
  )
}
