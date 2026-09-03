import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useQuery } from '@tanstack/react-query'
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
import LatestFeed from '../components/LatestFeed'
import LatestInspector from '../components/LatestInspector'
import { latestFeedQuery } from '../api/queries'
import ActivityFilter from '../components/ActivityFilter'
import type { ActivityType } from '../types'

export default function LatestPage() {
  const { companyId } = useCompany()
  const { userId } = useAuthz()
  const { isLarge, hasSlots } = useSplitLayout()
  const location = useLocation()
  const search = location.search as { activityId?: string }
  const activityId = search.activityId
  const [selectedId, setSelectedId] = React.useState<string | null>(
    activityId || null,
  )
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)
  const [activityTypes, setActivityTypes] = React.useState<Array<ActivityType>>(
    [],
  )

  React.useEffect(() => {
    if (activityId) {
      setSelectedId(activityId)
    }
  }, [activityId])

  const openedFromUrlRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!activityId || isLarge) return
    if (openedFromUrlRef.current === activityId) return
    openedFromUrlRef.current = activityId
    openDrawer()
  }, [activityId, isLarge, openDrawer])

  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedId(id)
      openDrawer()
    },
    [openDrawer],
  )

  const { isLoading: latestFeedLoading } = useQuery({
    ...latestFeedQuery({
      companyId: companyId ?? '',
      userId,
      limit: 100,
    }),
    enabled: !!companyId,
  })
  const showInitialSkeleton = useInitialPageLoad(latestFeedLoading)

  if (!companyId) {
    if (!isLarge) return <MobileSplitSkeleton />
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.latest}
        title="Latest"
        rightTitle="Details"
      />
    )
  }

  if (showInitialSkeleton && !isLarge) return <MobileSplitSkeleton />

  if (showInitialSkeleton && !hasSlots) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.latest}
        title="Latest"
        rightTitle="Details"
      />
    )
  }

  const filter = (
    <ActivityFilter
      selectedTypes={activityTypes}
      onTypesChange={setActivityTypes}
    />
  )

  const feed = (
    <LatestFeed
      selectedId={selectedId}
      onSelect={isLarge ? setSelectedId : handleSelect}
      activityTypes={activityTypes.length > 0 ? activityTypes : undefined}
      toolbarExtra={isLarge ? undefined : filter}
    />
  )

  const inspector = <LatestInspector activityId={selectedId} />

  if (!isLarge) {
    return (
      <MobileSplitView
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onToggle={toggleDrawer}
        drawerTitle="Details"
        inspector={inspector}
      >
        {feed}
      </MobileSplitView>
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.latest}
      title="Latest"
      leftToolbar={filter}
      left={feed}
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
