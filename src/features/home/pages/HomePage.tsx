// src/features/home/pages/HomePage.tsx
import * as React from 'react'
import { Box, Text } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { addDays, startOfMinute } from 'date-fns'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import { getInitialsFromNameOrEmail } from '@shared/lib/generalFunctions'
import { mattersIndexQueryAll } from '@features/matters/api/queries'
import { HomeDesktopLayout, HomeMobileLayout } from '@features/home/components'
import { companyJobsWeekQuery } from '@features/home/api/companyJobsWeekQuery'
import { companyWeekJobsBookingsQuery } from '@features/home/api/companyWeekJobsBookingsQuery'
import { jobsReadyToInvoiceQuery } from '@features/home/api/jobsReadyToInvoiceQuery'
import {
  defaultHomeDashboardLayoutPreferences,
  profileHomeLayoutQuery,
} from '@features/home/api/profileHomeLayoutQuery'
import { useUpcomingJobs } from '@features/home/hooks/useUpcomingJobs'
import { useHomeResizeLayout } from '@features/home/hooks/useHomeResizeLayout'
import {
  crewConflictsQuery,
  vehicleConflictsQuery,
} from '@features/conflicts/api/queries'
import type { HomeMatter } from '@features/home/types'

export default function HomePage() {
  const { companyId } = useCompany()
  const { userId, companyRole, caps } = useAuthz()

  const [daysFilter, setDaysFilter] = React.useState<'7' | '14' | '30' | 'all'>(
    'all',
  )
  const [showMyJobsOnly, setShowMyJobsOnly] = React.useState(true)
  const [jobsWeekOffset, setJobsWeekOffset] = React.useState<0 | 1>(0)

  const canVisitJobs = caps.has('visit:jobs')

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

  const { data: jobsReadyToInvoice = [], isLoading: jobsReadyToInvoiceLoading } =
    useQuery({
      ...jobsReadyToInvoiceQuery({
        companyId: companyId ?? '',
        userId: userId ?? '',
      }),
      enabled: !!companyId && !!userId && canVisitJobs,
    })

  const { data: companyWeekJobs = [], isLoading: companyWeekJobsLoading } =
    useQuery({
      ...companyJobsWeekQuery({
        companyId: companyId ?? '',
        weekOffset: jobsWeekOffset,
        userId,
        companyRole,
      }),
      enabled: !!companyId && canVisitJobs,
    })

  const jobsWeekBookingsMeta = React.useMemo(
    () =>
      companyWeekJobs.map((j) => ({
        id: j.id,
        leadUserId: j.project_lead?.user_id ?? null,
      })),
    [companyWeekJobs],
  )

  const { data: companyWeekBookingSummaries = {}, isLoading: companyWeekBookingsDetailLoading } =
    useQuery({
      ...companyWeekJobsBookingsQuery({
        companyId: companyId ?? '',
        weekOffset: jobsWeekOffset,
        jobsMeta: jobsWeekBookingsMeta,
      }),
      enabled:
        !!companyId &&
        canVisitJobs &&
        jobsWeekBookingsMeta.length > 0,
    })

  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    ...mattersIndexQueryAll(),
  })

  const unreadMatters = React.useMemo((): Array<HomeMatter> => {
    if (!mattersData) return []
    return mattersData.filter((matter) => matter.is_unread)
  }, [mattersData])

  // IMPORTANT: make range stable so queryKey doesn't change every render
  const { conflictFrom, conflictTo } = React.useMemo(() => {
    const now = startOfMinute(new Date())
    return {
      conflictFrom: now.toISOString(),
      conflictTo: addDays(now, 30).toISOString(),
    }
  }, [companyId])

  const { data: crewConflicts = [], isLoading: crewConflictsLoading } =
    useQuery({
      ...crewConflictsQuery({
        companyId: companyId ?? '',
        from: conflictFrom,
        to: conflictTo,
      }),
      enabled: !!companyId,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })
  const { data: vehicleConflicts = [], isLoading: vehicleConflictsLoading } =
    useQuery({
      ...vehicleConflictsQuery({
        companyId: companyId ?? '',
        from: conflictFrom,
        to: conflictTo,
      }),
      enabled: !!companyId,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })
  const conflictsLoading = crewConflictsLoading || vehicleConflictsLoading

  const getInitials = getInitialsFromNameOrEmail

  const getAvatarUrl = (avatarPath: string | null): string | null => {
    if (!avatarPath) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
    return data.publicUrl
  }

  const { isLarge, containerRef, leftPanelWidth, isResizing, setIsResizing } =
    useHomeResizeLayout()

  const { data: homeLayoutPrefs } = useQuery({
    ...profileHomeLayoutQuery(userId ?? ''),
    enabled: !!userId && !!companyId,
  })
  const homeLayout = homeLayoutPrefs ?? defaultHomeDashboardLayoutPreferences()

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
        userId={userId}
        canVisitJobs={canVisitJobs}
        companyWeekJobs={companyWeekJobs}
        companyWeekJobsLoading={companyWeekJobsLoading}
        companyWeekBookingSummaries={companyWeekBookingSummaries}
        companyWeekBookingsDetailLoading={companyWeekBookingsDetailLoading}
        jobsWeekOffset={jobsWeekOffset}
        onJobsWeekOffsetChange={setJobsWeekOffset}
        unreadMatters={unreadMatters}
        mattersLoading={mattersLoading}
        jobsReadyToInvoice={jobsReadyToInvoice}
        jobsReadyToInvoiceLoading={jobsReadyToInvoiceLoading}
        upcomingJobs={filteredUpcomingJobs}
        upcomingJobsLoading={upcomingJobsLoading}
        showMyJobsOnly={showMyJobsOnly}
        onToggleMyJobsOnly={setShowMyJobsOnly}
        isFreelancer={isFreelancer}
        daysFilter={daysFilter}
        onDaysFilterChange={setDaysFilter}
        getInitials={getInitials}
        getAvatarUrl={getAvatarUrl}
        crewConflicts={crewConflicts}
        vehicleConflicts={vehicleConflicts}
        conflictsLoading={conflictsLoading}
        homeLayout={homeLayout}
      />
    )
  }

  return (
    <HomeDesktopLayout
      containerRef={containerRef}
      leftPanelWidth={leftPanelWidth}
      isResizing={isResizing}
      onResizeStart={() => setIsResizing(true)}
      userId={userId}
      canVisitJobs={canVisitJobs}
      companyWeekJobs={companyWeekJobs}
      companyWeekJobsLoading={companyWeekJobsLoading}
      companyWeekBookingSummaries={companyWeekBookingSummaries}
      companyWeekBookingsDetailLoading={companyWeekBookingsDetailLoading}
      jobsWeekOffset={jobsWeekOffset}
      onJobsWeekOffsetChange={setJobsWeekOffset}
      unreadMatters={unreadMatters}
      mattersLoading={mattersLoading}
      jobsReadyToInvoice={jobsReadyToInvoice}
      jobsReadyToInvoiceLoading={jobsReadyToInvoiceLoading}
      upcomingJobs={filteredUpcomingJobs}
      upcomingJobsLoading={upcomingJobsLoading}
      showMyJobsOnly={showMyJobsOnly}
      onToggleMyJobsOnly={setShowMyJobsOnly}
      isFreelancer={isFreelancer}
      daysFilter={daysFilter}
      onDaysFilterChange={setDaysFilter}
      getInitials={getInitials}
      getAvatarUrl={getAvatarUrl}
      crewConflicts={crewConflicts}
      vehicleConflicts={vehicleConflicts}
      conflictsLoading={conflictsLoading}
      homeLayout={homeLayout}
    />
  )
}
