import * as React from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
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
import ConflictInspector from '../components/ConflictInspector'
import ConflictsFilter from '../components/ConflictsFilter'
import ConflictsList from '../components/ConflictsList'
import { useCompanyConflictBundle } from '../hooks/useCompanyConflictBundle'
import {
  DEFAULT_CONFLICT_LIST_FILTERS,
  filterConflictItems,
  sortConflictItems,
} from '../utils/conflictItems'
import type { ConflictListFilters } from '../utils/conflictItems'

export default function ConflictsPage() {
  const { companyId } = useCompany()
  const { userId } = useAuthz()
  const navigate = useNavigate()
  const location = useLocation()
  const { isLarge, hasSlots } = useSplitLayout()
  const search = location.search as { conflictId?: string }
  const conflictId = search.conflictId
  const [selectedId, setSelectedId] = React.useState<string | null>(
    conflictId || null,
  )
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)
  const [filters, setFilters] = React.useState<ConflictListFilters>(
    DEFAULT_CONFLICT_LIST_FILTERS,
  )

  React.useEffect(() => {
    setSelectedId(conflictId || null)
  }, [conflictId])

  const openedFromUrlRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!conflictId || isLarge) return
    if (openedFromUrlRef.current === conflictId) return
    openedFromUrlRef.current = conflictId
    openDrawer()
  }, [conflictId, isLarge, openDrawer])

  const writeSelection = React.useCallback(
    (id: string | null) => {
      setSelectedId(id)
      void navigate({
        to: '/conflicts',
        search: { conflictId: id ?? undefined },
        replace: true,
      })
    },
    [navigate],
  )

  const handleSelect = React.useCallback(
    (id: string) => {
      writeSelection(id)
      openDrawer()
    },
    [openDrawer, writeSelection],
  )

  const {
    attentionNow,
    attentionCards: items,
    isLoading: conflictsLoading,
  } = useCompanyConflictBundle({ enabled: !!companyId })

  const { data: projectLeadJobIds = [] } = useQuery({
    ...projectLeadJobIdsQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId,
  })

  const showInitialSkeleton = useInitialPageLoad(conflictsLoading)

  const visibleItems = React.useMemo(
    () =>
      sortConflictItems(filterConflictItems(items, filters, projectLeadJobIds)),
    [items, filters, projectLeadJobIds],
  )
  const filtersActive =
    filters.status !== 'all' ||
    filters.kind !== 'all' ||
    filters.scope !== 'company'
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
      onSelect={isLarge ? writeSelection : handleSelect}
      loading={conflictsLoading && !showInitialSkeleton}
      toolbarExtra={isLarge ? undefined : filter}
      projectLeadJobIds={projectLeadJobIds}
      attentionFrom={attentionNow}
      filtersActive={filtersActive}
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
