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
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { InfoCircle, Plus, Search } from 'iconoir-react'
import { VirtualIndexTable, useVirtualIndexTable } from '@shared/ui/index-table'
import { customersIndexQuery } from '../api/queries'
import AddCustomerDialog from './dialogs/AddCustomerDialog'
import type { IndexColumn } from '@shared/ui/index-table'

const GRID_COLUMNS = 'minmax(180px, 2fr) 100px 100px'

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
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  showRegular: boolean
  showPartner: boolean
  createShortcutRef?: React.MutableRefObject<(() => void) | null>
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
            return r.is_partner ? (
              <Badge variant="soft" color="green">
                Partner
              </Badge>
            ) : (
              <Badge variant="soft">Customer</Badge>
            )
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

          {canWrite && (
            <Button
              variant="solid"
              onClick={() => setAddOpen(true)}
              style={isMobile ? { width: '100%' } : undefined}
              size={isMobile ? '3' : '2'}
            >
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
      }
    />
  )
}
