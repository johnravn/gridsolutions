import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'iconoir-react'
import { Box, Button, Flex, Spinner, Text, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { vehiclesIndexQuery } from '../api/queries'
import VehiclesGrid from './VehiclesGrid'
import VehiclesList from './VehiclesList'
import AddEditVehicleDialog from './dialogs/AddEditVehicleDialog'

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  includeExternal: boolean
  viewMode: 'grid' | 'list'
  search: string
  onSearch: (v: string) => void
}

export default function VehiclesView({
  selectedId,
  onSelect,
  includeExternal,
  viewMode,
  search,
  onSearch,
}: Props) {
  const { companyId } = useCompany()
  const [addOpen, setAddOpen] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const tableRef = React.useRef<HTMLTableElement | null>(null)
  const pagerRef = React.useRef<HTMLDivElement>(null)

  const {
    data: allData = [],
    isLoading,
    isFetching,
  } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '__none__',
      includeExternal,
      search,
    }),
    enabled: !!companyId,
  })

  // Recompute page size based on available space
  const recomputePageSize = React.useCallback(() => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const screenH = containerRect.height

    if (screenH === 0) return

    const controlsH = controlsRef.current?.offsetHeight ?? 0
    const theadH = tableRef.current?.querySelector('thead')?.offsetHeight ?? 0
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

    const visibleRow = containerRef.current?.querySelector<HTMLTableRowElement>(
      'tbody tr:not([data-row-probe])',
    )
    const rowH = visibleRow?.getBoundingClientRect().height || 60

    // Be conservative - don't add extra rows, and use floor to ensure we don't overflow
    const rows = Math.max(5, Math.min(50, Math.floor(available / rowH)))
    setPageSize(rows)
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
    if (!isLoading && allData.length > 0) {
      requestAnimationFrame(() => {
        recomputePageSize()
      })
    }
  }, [isLoading, allData.length, recomputePageSize, viewMode])

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1)
  }, [search, includeExternal, viewMode])

  // Paginate the data (only for list view)
  const totalPages = Math.ceil(allData.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const data =
    viewMode === 'list' ? allData.slice(startIndex, endIndex) : allData

  return (
    <Box
      ref={containerRef}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div ref={controlsRef}>
        <Flex gap="2" align="center" wrap="wrap">
          <TextField.Root
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search vehicles…"
            size="3"
            style={{ flex: '1 1 260px' }}
          >
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
            <TextField.Slot side="right">
              {(isLoading || isFetching) && <Spinner />}
            </TextField.Slot>
          </TextField.Root>

          <Button variant="classic" onClick={() => setAddOpen(true)}>
            Add vehicle
          </Button>
        </Flex>
      </div>

      <Box style={{ flex: 1, minHeight: 0 }}>
        {viewMode === 'grid' ? (
          <VehiclesGrid
            rows={data}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ) : (
          <div
            ref={(el) => {
              if (el) {
                tableRef.current = el.querySelector('table')
              }
            }}
          >
            <VehiclesList
              rows={data}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          </div>
        )}
      </Box>

      {viewMode === 'list' && allData.length > 0 && (
        <div ref={pagerRef}>
          <Flex align="center" justify="between" mt="3">
            <Text size="2" color="gray">
              Showing {startIndex + 1}-{Math.min(endIndex, allData.length)} of{' '}
              {allData.length} vehicles
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

      <AddEditVehicleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
        onSaved={() => {
          // rely on query invalidation inside the dialog
        }}
      />
    </Box>
  )
}
