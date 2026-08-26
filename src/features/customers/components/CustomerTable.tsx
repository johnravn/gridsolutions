import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Flex,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  MOBILE_LIST_BOTTOM_PAD,
  MobileBottomActionBar,
  MobilePageList,
} from '@app/layout/mobile'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { InfoCircle, Plus, Search } from 'iconoir-react'
import {
  IndexTableBodySkeleton,
  VirtualIndexTable,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import {
  INDEX_TABLE_ROW_CLASS,
  INDEX_TABLE_ROW_SELECTED_CLASS,
} from '@shared/ui/index-table/indexTableStyles'
import { customersIndexQuery } from '../api/queries'
import AddCustomerDialog from './dialogs/AddCustomerDialog'
import type { IndexColumn } from '@shared/ui/index-table'

const GRID_COLUMNS = 'minmax(180px, 2fr) 100px 100px'
const PAGE_GRID_COLUMNS = 'minmax(0, 1fr) auto'

const COLUMNS: Array<IndexColumn> = [
  { id: 'name', header: 'Name' },
  {
    id: 'type',
    header: (
      <Flex gap="1" align="center">
        Type
        <Tooltip content="Customer: normal customer. Partner: can be used as a job subcontractor or external vehicle owner.">
          <InfoCircle width="1em" height="1em" />
        </Tooltip>
      </Flex>
    ),
  },
  { id: 'crew_rate', header: 'Crew rate' },
]

export default function CustomerTable({
  createShortcutRef,
  selectedId,
  onSelect,
  showRegular,
  showPartner,
  toolbarExtra,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  showRegular: boolean
  showPartner: boolean
  createShortcutRef?: React.MutableRefObject<(() => void) | null>
  toolbarExtra?: React.ReactNode
}) {
  const { companyId } = useCompany()
  const { canWrite } = useCompanyWriteAccess()
  const qc = useQueryClient()
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [addOpen, setAddOpen] = React.useState(false)
  React.useEffect(() => {
    if (!createShortcutRef) return
    createShortcutRef.current = () => setAddOpen(true)
    return () => {
      createShortcutRef.current = null
    }
  }, [createShortcutRef])

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

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (r) => r.id,
    estimateRowSize: 52,
  })

  const toolbar = (
    <Flex gap={isMobile ? '4' : '2'} align="center" wrap="wrap">
      <Flex
        gap="3"
        align="center"
        style={{ width: isMobile ? '100%' : undefined, flex: 1, minWidth: 0 }}
      >
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers…"
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
            {(isFetching || isLoading) && (
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner size="2" />
              </Flex>
            )}
          </TextField.Slot>
        </TextField.Root>
        {isMobile ? toolbarExtra : null}
      </Flex>

      {canWrite && !isMobile && (
        <Button variant="solid" onClick={() => setAddOpen(true)} size="3">
          <Plus width={18} height={18} />
          Add customer
        </Button>
      )}

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
  )

  const renderType = (r: (typeof rows)[number]) =>
    r.is_partner ? (
      <Badge variant="soft" color="green">
        Partner
      </Badge>
    ) : (
      <Badge variant="soft">Customer</Badge>
    )

  if (isMobile) {
    return (
      <>
        <MobilePageList toolbar={toolbar}>
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
              style={{ paddingBottom: MOBILE_LIST_BOTTOM_PAD }}
            >
              {rows.map((r) => {
                const isSelected = r.id === selectedId
                return (
                  <div
                    key={r.id}
                    className={[
                      INDEX_TABLE_ROW_CLASS,
                      isSelected ? INDEX_TABLE_ROW_SELECTED_CLASS : undefined,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(r.id)
                      }
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: PAGE_GRID_COLUMNS,
                      gap: 'var(--space-3)',
                      alignItems: 'center',
                      padding: '16px 12px',
                      minHeight: 64,
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-3)',
                    }}
                  >
                    <Text size="2" weight="medium">
                      {r.name}
                    </Text>
                    {renderType(r)}
                  </div>
                )
              })}
            </Flex>
          )}
          {rows.length > 0 && (
            <Text size="2" color="gray">
              {rows.length} customer{rows.length !== 1 ? 's' : ''}
            </Text>
          )}
        </MobilePageList>
        {canWrite && (
          <MobileBottomActionBar>
            <Button variant="ghost" size="3" onClick={() => setAddOpen(true)}>
              <Plus width={18} height={18} />
              Add customer
            </Button>
          </MobileBottomActionBar>
        )}
      </>
    )
  }

  return (
    <VirtualIndexTable
      rows={rows}
      columns={COLUMNS}
      gridTemplateColumns={GRID_COLUMNS}
      getRowId={(r) => r.id}
      renderCell={(r, colId) => {
        switch (colId) {
          case 'name':
            return (
              <Text size="2" weight="medium">
                {r.name}
              </Text>
            )
          case 'type':
            return renderType(r)
          case 'crew_rate':
            return (
              <Text size="1" color="gray">
                {(r as { crew_pricing_level?: { name?: string } })
                  .crew_pricing_level?.name ?? 'Standard'}
              </Text>
            )
          default:
            return null
        }
      }}
      selectedId={selectedId}
      onSelect={onSelect}
      scrollRef={scrollRef}
      rowVirtualizer={rowVirtualizer}
      isLoading={isLoading}
      emptyMessage="No results"
      footerCount={{
        shown: rows.length,
        label: (n) => `${n} customer${n !== 1 ? 's' : ''}`,
      }}
      toolbar={toolbar}
    />
  )
}
