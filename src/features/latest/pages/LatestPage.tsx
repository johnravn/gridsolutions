import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useQuery } from '@tanstack/react-query'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import ScrollToTopButton from '@shared/ui/components/ScrollToTopButton'
import { MOBILE_CARD_HEIGHT } from '@app/layout/mobileLayout'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'
import { SPLIT_LEFT_WIDTH, SplitPage, SplitPageSkeleton, useSplitLayout } from '@app/layout/split'
import LatestFeed from '../components/LatestFeed'
import LatestInspector from '../components/LatestInspector'
import { latestFeedQuery } from '../api/queries'
import ActivityFilter from '../components/ActivityFilter'
import type { ActivityType } from '../types'

export default function LatestPage() {
  const { companyId } = useCompany()
  const { isLarge, hasSlots } = useSplitLayout()
  const location = useLocation()
  const search = location.search as { activityId?: string }
  const activityId = search.activityId
  const [selectedId, setSelectedId] = React.useState<string | null>(
    activityId || null,
  )
  const [activityTypes, setActivityTypes] = React.useState<Array<ActivityType>>(
    [],
  )
  const inspectorRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    if (activityId) {
      setSelectedId(activityId)
    }
  }, [activityId])

  React.useEffect(() => {
    if (!isLarge && selectedId != null && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [isLarge, selectedId])

  const clearSelection = React.useCallback(() => {
    setSelectedId(null)
  }, [])

  useMobileDetailBack(!isLarge, selectedId != null, clearSelection)

  const { isLoading: latestFeedLoading } = useQuery({
    ...latestFeedQuery({
      companyId: companyId ?? '',
      limit: 100,
    }),
    enabled: !!companyId,
  })
  const showInitialSkeleton = useInitialPageLoad(latestFeedLoading)

  if (!companyId || (showInitialSkeleton && !hasSlots)) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.latest}
        title="Latest"
        rightTitle="Details"
      />
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.latest}
      title="Latest"
      leftToolbar={
        <ActivityFilter
          selectedTypes={activityTypes}
          onTypesChange={setActivityTypes}
        />
      }
      left={
        <LatestFeed
          selectedId={selectedId}
          onSelect={setSelectedId}
          activityTypes={activityTypes.length > 0 ? activityTypes : undefined}
        />
      }
      leftBodyStyle={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      mobileLeftBodyStyle={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      rightTitle="Details"
      right={<LatestInspector activityId={selectedId} />}
      mobileLeftCardStyle={{ height: MOBILE_CARD_HEIGHT, minWidth: 0 }}
      mobileRightCardStyle={{
        height: MOBILE_CARD_HEIGHT,
        overflow: 'hidden',
        maxWidth: '100%',
      }}
      mobileSectionRef={listRef}
      mobileRightWrapper={(card) => (
        <div
          ref={inspectorRef}
          style={{
            minHeight: 0,
            maxWidth: '100%',
            width: '100%',
            height: MOBILE_CARD_HEIGHT,
          }}
        >
          {card}
        </div>
      )}
      mobileFooter={
        <ScrollToTopButton
          listRef={listRef}
          inspectorRef={inspectorRef}
          visible={!isLarge}
        />
      }
    />
  )
}
