import * as React from 'react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useQuery } from '@tanstack/react-query'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useRegisterShortcutAction } from '@shared/hotkeys'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import { SPLIT_LEFT_WIDTH, SplitPage, SplitPageSkeleton, useSplitLayout } from '@app/layout/split'
import VehiclesView from '../components/VehiclesView'
import VehicleInspector from '../components/VehicleInspector'
import VehiclesFilter from '../components/VehiclesFilter'
import { vehiclesIndexQuery } from '../api/queries'

export default function VehiclesPage() {
  const { companyId } = useCompany()
  const { canWrite } = useCompanyWriteAccess()
  const { hasSlots } = useSplitLayout()
  const createVehicleShortcutRef = React.useRef<(() => void) | null>(null)
  useRegisterShortcutAction(
    'create.vehicle',
    () => createVehicleShortcutRef.current?.(),
    canWrite,
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [includeExternal, setIncludeExternal] = React.useState(true)
  const [search, setSearch] = React.useState('')

  const { isLoading: vehiclesIndexLoading } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '__none__',
      includeExternal: true,
      search: '',
    }),
    enabled: !!companyId,
  })
  const showInitialSkeleton = useInitialPageLoad(vehiclesIndexLoading)

  if (!companyId || (showInitialSkeleton && !hasSlots)) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.vehicles}
        title="Vehicles"
      />
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.vehicles}
      title="Vehicles"
      leftToolbar={
        <VehiclesFilter
          includeExternal={includeExternal}
          onIncludeExternalChange={setIncludeExternal}
        />
      }
      left={
        <VehiclesView
          createShortcutRef={createVehicleShortcutRef}
          selectedId={selectedId}
          onSelect={setSelectedId}
          includeExternal={includeExternal}
          search={search}
          onSearch={setSearch}
        />
      }
      leftBodyStyle={{ overflowY: 'auto' }}
      right={<VehicleInspector id={selectedId} />}
    />
  )
}
