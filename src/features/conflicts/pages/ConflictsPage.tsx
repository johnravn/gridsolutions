import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { startOfMinute } from 'date-fns'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import { projectLeadJobIdsQuery } from '@features/home/api/projectLeadJobIdsQuery'
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
import {
  crewConflictsQuery,
  equipmentConflictsQuery,
  groupConflictsQuery,
  vehicleConflictsQuery,
} from '../api/queries'
import ConflictInspector from '../components/ConflictInspector'
import ConflictsFilter from '../components/ConflictsFilter'
import ConflictsList from '../components/ConflictsList'
import {
  keepAttentionEquipmentConflicts,
  keepAttentionPairConflicts,
} from '../utils/filterConflictsByProjectLead'
import { buildConflictCards, filterConflictItems } from '../utils/conflictItems'
import type { ConflictListFilters } from '../utils/conflictItems'

export default function ConflictsPage() {
  const { companyId } = useCompany()
  const { userId } = useAuthz()
  const { isLarge, hasSlots } = useSplitLayout()
  const location = useLocation()
  const search = location.search as { conflictId?: string }
  const conflictId = search.conflictId
  const [selectedId, setSelectedId] = React.useState<string | null>(
    conflictId || null,
  )
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)
  const [filters, setFilters] = React.useState<ConflictListFilters>({
    status: 'all',
    kind: 'all',
  })

  React.useEffect(() => {
    if (conflictId) {
      setSelectedId(conflictId)
    }
  }, [conflictId])

  const openedFromUrlRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!conflictId || isLarge) return
    if (openedFromUrlRef.current === conflictId) return
    openedFromUrlRef.current = conflictId
    openDrawer()
  }, [conflictId, isLarge, openDrawer])

  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedId(id)
      openDrawer()
    },
    [openDrawer],
  )

  const { data: crewConflicts = [], isLoading: crewLoading } = useQuery({
    ...crewConflictsQuery({
      companyId: companyId ?? '',
      from: null,
      to: null,
    }),
    enabled: !!companyId,
  })
  const { data: vehicleConflicts = [], isLoading: vehicleLoading } = useQuery({
    ...vehicleConflictsQuery({
      companyId: companyId ?? '',
      from: null,
      to: null,
    }),
    enabled: !!companyId,
  })
  const { data: equipmentConflicts = [], isLoading: equipmentLoading } =
    useQuery({
      ...equipmentConflictsQuery({
        companyId: companyId ?? '',
        from: null,
        to: null,
      }),
      enabled: !!companyId,
    })
  const { data: groupConflicts = [], isLoading: groupLoading } = useQuery({
    ...groupConflictsQuery({
      companyId: companyId ?? '',
      from: null,
      to: null,
    }),
    enabled: !!companyId,
  })
  const { data: projectLeadJobIds = [] } = useQuery({
    ...projectLeadJobIdsQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId,
  })

  const conflictsLoading =
    crewLoading || vehicleLoading || equipmentLoading || groupLoading
  const showInitialSkeleton = useInitialPageLoad(conflictsLoading)

  const items = React.useMemo(() => {
    const attentionNow = startOfMinute(new Date())
    return buildConflictCards(
      keepAttentionPairConflicts(crewConflicts, attentionNow),
      keepAttentionPairConflicts(vehicleConflicts, attentionNow),
      keepAttentionEquipmentConflicts(equipmentConflicts, attentionNow),
      keepAttentionPairConflicts(groupConflicts, attentionNow),
    )
  }, [crewConflicts, vehicleConflicts, equipmentConflicts, groupConflicts])
  const visibleItems = React.useMemo(
    () => filterConflictItems(items, filters),
    [items, filters],
  )
  const selected = items.find((item) => item.key === selectedId) ?? null
  const missingSelected = Boolean(selectedId && !conflictsLoading && !selected)

  if (!companyId) {
    if (!isLarge) return <MobileSplitSkeleton />
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.conflicts}
        title="Conflicts"
        rightTitle="Details"
      />
    )
  }

  if (showInitialSkeleton && !isLarge) return <MobileSplitSkeleton />

  if (showInitialSkeleton && !hasSlots) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.conflicts}
        title="Conflicts"
        rightTitle="Details"
      />
    )
  }

  const filter = <ConflictsFilter filters={filters} onChange={setFilters} />
  const list = (
    <ConflictsList
      items={visibleItems}
      selectedId={selectedId}
      onSelect={isLarge ? setSelectedId : handleSelect}
      loading={conflictsLoading && !showInitialSkeleton}
      toolbarExtra={isLarge ? undefined : filter}
      projectLeadJobIds={projectLeadJobIds}
    />
  )
  const inspector = (
    <ConflictInspector item={selected} missing={missingSelected} />
  )

  if (!isLarge) {
    return (
      <MobileSplitView
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onToggle={toggleDrawer}
        drawerTitle="Details"
        inspector={inspector}
      >
        {list}
      </MobileSplitView>
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.conflicts}
      title="Conflicts"
      leftToolbar={filter}
      left={list}
      leftBodyStyle={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      rightTitle="Details"
      right={inspector}
    />
  )
}
