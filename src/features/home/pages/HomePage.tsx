// src/features/home/pages/HomePage.tsx
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Box, Text } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import {
  getInitialsFromNameOrEmail,
} from '@shared/lib/generalFunctions'
import { latestFeedQuery } from '@features/latest/api/queries'
import { mattersIndexQueryAll } from '@features/matters/api/queries'
import {
  HomeDesktopLayout,
  HomeMobileLayout,
} from '@features/home/components'
import { useUpcomingJobs } from '@features/home/hooks/useUpcomingJobs'
import { useHomeResizeLayout } from '@features/home/hooks/useHomeResizeLayout'
import type { HomeMatter } from '@features/home/types'

export default function HomePage() {
  const { companyId } = useCompany()
  const { userId, companyRole, caps } = useAuthz()
  const navigate = useNavigate()

  const [daysFilter, setDaysFilter] = React.useState<'7' | '14' | '30' | 'all'>(
    'all',
  )
  const [showMyJobsOnly, setShowMyJobsOnly] = React.useState(true)

  const canSeeLatest = caps.has('visit:latest')

  const {
    jobs: filteredUpcomingJobs,
    loading: upcomingJobsLoading,
    isFreelancer,
  } = useUpcomingJobs({
    companyId,
    userId,
    companyRole,
    daysFilter,
    showMyJobsOnly,
  })

  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    ...mattersIndexQueryAll(),
  })

  const unreadMatters = React.useMemo((): Array<HomeMatter> => {
    if (!mattersData) return []
    return mattersData.filter((matter) => matter.is_unread)
  }, [mattersData])

  const { data: latestData, isLoading: latestLoading } = useQuery({
    ...latestFeedQuery({
      companyId: companyId ?? '',
      limit: 10,
    }),
    enabled: !!companyId && canSeeLatest,
  })

  const handleLatestClick = (activityId: string) => {
    navigate({
      to: '/latest',
      search: { activityId },
    })
  }

  const getInitials = getInitialsFromNameOrEmail

  const getAvatarUrl = (avatarPath: string | null): string | null => {
    if (!avatarPath) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
    return data.publicUrl
  }

  const {
    isLarge,
    containerRef,
    leftPanelWidth,
    isResizing,
    setIsResizing,
  } = useHomeResizeLayout()

  if (!companyId) {
    return (
      <Box p="4">
        <Text>Please select a company</Text>
      </Box>
    )
  }

  if (!isLarge) {
    return (
      <HomeMobileLayout
        canSeeLatest={canSeeLatest}
        latestActivities={latestData?.items || []}
        latestLoading={latestLoading}
        onLatestClick={handleLatestClick}
        unreadMatters={unreadMatters}
        mattersLoading={mattersLoading}
        upcomingJobs={filteredUpcomingJobs}
        upcomingJobsLoading={upcomingJobsLoading}
        showMyJobsOnly={showMyJobsOnly}
        onToggleMyJobsOnly={setShowMyJobsOnly}
        isFreelancer={isFreelancer}
        daysFilter={daysFilter}
        onDaysFilterChange={setDaysFilter}
        getInitials={getInitials}
        getAvatarUrl={getAvatarUrl}
      />
    )
  }

  return (
    <HomeDesktopLayout
      containerRef={containerRef}
      leftPanelWidth={leftPanelWidth}
      isResizing={isResizing}
      onResizeStart={() => setIsResizing(true)}
      canSeeLatest={canSeeLatest}
      latestActivities={latestData?.items || []}
      latestLoading={latestLoading}
      onLatestClick={handleLatestClick}
      unreadMatters={unreadMatters}
      mattersLoading={mattersLoading}
      upcomingJobs={filteredUpcomingJobs}
      upcomingJobsLoading={upcomingJobsLoading}
      showMyJobsOnly={showMyJobsOnly}
      onToggleMyJobsOnly={setShowMyJobsOnly}
      isFreelancer={isFreelancer}
      daysFilter={daysFilter}
      onDaysFilterChange={setDaysFilter}
      getInitials={getInitials}
      getAvatarUrl={getAvatarUrl}
    />
  )
}
