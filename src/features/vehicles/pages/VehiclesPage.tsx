import * as React from 'react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useQuery } from '@tanstack/react-query'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useRegisterShortcutAction } from '@shared/hotkeys'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import {
  MobileSplitSkeleton,
  MobileSplitView,
  useMobileInspectorDrawer,
} from '@app/layout/mobile'
import {
  SPLIT_LEFT_WIDTH,
  SplitPage,
  SplitPageSkeleton,
  useSplitLayout,
} from '@app/layout/split'
import VehiclesView from '../components/VehiclesView'
import VehicleInspector from '../components/VehicleInspector'
import VehiclesFilter from '../components/VehiclesFilter'
import { vehiclesIndexQuery } from '../api/queries'

export default function VehiclesPage() {
  const { companyId } = useCompany()
  const { canWrite } = useCompanyWriteAccess()
  const { isLarge, hasSlots } = useSplitLayout()
  const createVehicleShortcutRef = React.useRef<(() => void) | null>(null)
  useRegisterShortcutAction(
    'create.vehicle',
    () => createVehicleShortcutRef.current?.(),
    canWrite,
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)
  const [includeExternal, setIncludeExternal] = React.useState(true)
  const [search, setSearch] = React.useState('')

  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedId(id)
      openDrawer()
    },
    [openDrawer],
  )

  const { isLoading: vehiclesIndexLoading } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '__none__',
      includeExternal: true,
      search: '',
    }),
    enabled: !!companyId,
  })
  const showInitialSkeleton = useInitialPageLoad(vehiclesIndexLoading)

  if (!companyId) {
    if (!isLarge) return <MobileSplitSkeleton />
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.vehicles}
        title="Vehicles"
      />
    )
  }

  if (showInitialSkeleton && !isLarge) return <MobileSplitSkeleton />

  if (showInitialSkeleton && !hasSlots) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.vehicles}
        title="Vehicles"
      />
    )
  }

  const filter = (
    <VehiclesFilter
      includeExternal={includeExternal}
      onIncludeExternalChange={setIncludeExternal}
    />
  )

  const table = (
    <VehiclesView
      createShortcutRef={createVehicleShortcutRef}
      selectedId={selectedId}
      onSelect={isLarge ? setSelectedId : handleSelect}
      includeExternal={includeExternal}
      search={search}
      onSearch={setSearch}
      toolbarExtra={isLarge ? undefined : filter}
    />
  )

  const inspector = <VehicleInspector id={selectedId} />

  if (!isLarge) {
    return (
      <MobileSplitView
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onToggle={toggleDrawer}
        inspector={inspector}
      >
        {table}
      </MobileSplitView>
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.vehicles}
      title="Vehicles"
      leftToolbar={filter}
      left={table}
      leftBodyStyle={{ overflowY: 'auto' }}
      right={inspector}
    />
  )
}
