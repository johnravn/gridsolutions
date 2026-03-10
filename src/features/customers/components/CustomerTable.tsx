import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { InfoCircle, Plus, Search } from 'iconoir-react'
import { customersIndexQuery } from '../api/queries'
import AddCustomerDialog from './dialogs/AddCustomerDialog'

const GRID_COLUMNS = 'minmax(180px, 2fr) 100px 100px'

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
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [addOpen, setAddOpen] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const {
    data: rows = [],
    isFetching,
    isLoading,
  } = useQuery({
    ...customersIndexQuery({
      companyId: companyId ?? '__none__',
      search: debouncedSearch,
      showRegular,
      showPartner,
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
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div ref={controlsRef} style={{ minWidth: 0 }}>
        <Flex
          gap="2"
          align="center"
          wrap="wrap"
          direction={isMobile ? 'column' : 'row'}
        >
          <TextField.Root
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            size="3"
            style={{ flex: isMobile ? undefined : '1 1 260px', width: '100%' }}
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

          <Button
            variant="solid"
            onClick={() => setAddOpen(true)}
            style={isMobile ? { width: '100%' } : undefined}
            size={isMobile ? '3' : '2'}
          >
            <Plus width={18} height={18} />
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

      {/* Table: header + body in horizontal scroll so headers scroll with rows */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          marginTop: 16,
        }}
      >
        <div style={{ minWidth: 'max-content', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRID_COLUMNS,
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--gray-a2)',
              borderRadius: 'var(--radius-2)',
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
        <div
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          Crew rate
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
                  <div>
                    <Text size="1" color="gray">
                      {(r as any).crew_pricing_level?.name ?? 'Standard'}
                    </Text>
                  </div>
                </div>
              )
            })}
          </div>
        )}
          </div>
        </div>
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
