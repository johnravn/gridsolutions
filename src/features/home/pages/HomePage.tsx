// src/features/home/pages/HomePage.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import HomePageSkeleton from '@shared/ui/components/HomePageSkeleton'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { startOfMinute } from 'date-fns'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import { getInitialsFromNameOrEmail } from '@shared/lib/generalFunctions'
import { mattersIndexQueryAll } from '@features/matters/api/queries'
import { useJobCrewRoleIds } from '@features/jobs/hooks/useJobCrewRoleIds'
import { HomeDesktopLayout, HomeMobileLayout } from '@features/home/components'
import { companyJobsWeekQuery } from '@features/home/api/companyJobsWeekQuery'
import { companyWeekJobsBookingsQuery } from '@features/home/api/companyWeekJobsBookingsQuery'
import { activeRecurringJobsQuery } from '@features/home/api/activeRecurringJobsQuery'
import { jobsReadyToInvoiceQuery } from '@features/home/api/jobsReadyToInvoiceQuery'
import { projectLeadJobIdsQuery } from '@features/home/api/projectLeadJobIdsQuery'
import {
  defaultHomeDashboardLayoutPreferences,
  profileHomeLayoutQuery,
} from '@features/home/api/profileHomeLayoutQuery'
import { resolveMyJobRole } from '@features/home/utils/resolveMyJobRole'
import {
  crewConflictsQuery,
  equipmentConflictsQuery,
  vehicleConflictsQuery,
} from '@features/conflicts/api/queries'
import {
  filterCrewConflictsByProjectLead,
  filterEquipmentConflictsByProjectLead,
  filterVehicleConflictsByProjectLead,
} from '@features/conflicts/utils/filterConflictsByProjectLead'
import type { JobListRow } from '@features/jobs/types'
import type { HomeMatter, WeekJobWithRole } from '@features/home/types'

const LARGE_BREAKPOINT = '(min-width: 1024px)'

function withMyJobRoles(
  jobs: Array<JobListRow>,
  userId: string | null,
  crewJobIdSet: Set<string>,
  isFreelancer: boolean,
): Array<WeekJobWithRole> {
  return jobs.map((job) => ({
    ...job,
    my_job_role: resolveMyJobRole({
      userId,
      projectLeadUserId: job.project_lead?.user_id,
      isCrew: isFreelancer || crewJobIdSet.has(job.id),
    }),
  }))
}

function filterMyJobs(
  jobs: Array<WeekJobWithRole>,
  showMyJobsOnly: boolean,
  isFreelancer: boolean,
): Array<WeekJobWithRole> {
  if (isFreelancer || !showMyJobsOnly) return jobs
  return jobs.filter((job) => job.my_job_role !== null)
}

export default function HomePage() {
  const { companyId } = useCompany()
  const { userId, companyRole, caps } = useAuthz()
  const isLarge = useMediaQuery(LARGE_BREAKPOINT)
  const isFreelancer = companyRole === 'freelancer'

  const [showMyJobsOnly, setShowMyJobsOnly] = React.useState(false)
  const [mobileWeekSegment, setMobileWeekSegment] = React.useState<0 | 1>(0)

  const canVisitJobs = caps.has('visit:jobs')

  const {
    data: jobsReadyToInvoice = [],
    isLoading: jobsReadyToInvoiceLoading,
  } = useQuery({
    ...jobsReadyToInvoiceQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId && canVisitJobs,
  })

  const { data: week0Jobs = [], isLoading: week0Loading } = useQuery({
    ...companyJobsWeekQuery({
      companyId: companyId ?? '',
      weekOffset: 0,
      userId,
      companyRole,
    }),
    enabled: !!companyId && canVisitJobs,
  })

  const { data: week1Jobs = [], isLoading: week1Loading } = useQuery({
    ...companyJobsWeekQuery({
      companyId: companyId ?? '',
      weekOffset: 1,
      userId,
      companyRole,
    }),
    enabled: !!companyId && canVisitJobs,
  })

  const { data: week2Jobs = [], isLoading: week2Loading } = useQuery({
    ...companyJobsWeekQuery({
      companyId: companyId ?? '',
      weekOffset: 2,
      userId,
      companyRole,
    }),
    enabled: !!companyId && canVisitJobs,
  })

  const companyWeekJobsLoading = week0Loading || week1Loading || week2Loading

  const bookingsSourceJobs = React.useMemo(() => {
    const byId = new Map<string, (typeof week0Jobs)[number]>()
    for (const job of week0Jobs) byId.set(job.id, job)
    for (const job of week1Jobs) byId.set(job.id, job)
    for (const job of week2Jobs) byId.set(job.id, job)
    return Array.from(byId.values())
  }, [week0Jobs, week1Jobs, week2Jobs])

  const jobsWeekBookingsMeta = React.useMemo(
    () =>
      bookingsSourceJobs.map((j) => ({
        id: j.id,
        leadUserId: j.project_lead?.user_id ?? null,
      })),
    [bookingsSourceJobs],
  )

  const {
    data: companyWeekBookingSummaries = {},
    isLoading: companyWeekBookingsDetailLoading,
  } = useQuery({
    ...companyWeekJobsBookingsQuery({
      companyId: companyId ?? '',
      weekOffset: isLarge ? 0 : mobileWeekSegment,
      jobsMeta: jobsWeekBookingsMeta,
    }),
    enabled: !!companyId && canVisitJobs && jobsWeekBookingsMeta.length > 0,
  })

  const { data: activeRecurringJobs = [] } = useQuery({
    ...activeRecurringJobsQuery({ companyId: companyId ?? '' }),
    enabled: !!companyId && canVisitJobs,
  })

  const allWeekJobIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const job of week0Jobs) ids.add(job.id)
    for (const job of week1Jobs) ids.add(job.id)
    for (const job of week2Jobs) ids.add(job.id)
    return Array.from(ids)
  }, [week0Jobs, week1Jobs, week2Jobs])

  const crewJobIdSet = useJobCrewRoleIds({
    companyId,
    userId,
    jobIds: isFreelancer ? [] : allWeekJobIds,
  })

  const jobsThisWeek = React.useMemo(
    () =>
      filterMyJobs(
        withMyJobRoles(week0Jobs, userId, crewJobIdSet, isFreelancer),
        showMyJobsOnly,
        isFreelancer,
      ),
    [week0Jobs, userId, crewJobIdSet, isFreelancer, showMyJobsOnly],
  )

  const jobsNextWeek = React.useMemo(
    () =>
      filterMyJobs(
        withMyJobRoles(week1Jobs, userId, crewJobIdSet, isFreelancer),
        showMyJobsOnly,
        isFreelancer,
      ),
    [week1Jobs, userId, crewJobIdSet, isFreelancer, showMyJobsOnly],
  )

  const jobsWeekAfter = React.useMemo(
    () =>
      filterMyJobs(
        withMyJobRoles(week2Jobs, userId, crewJobIdSet, isFreelancer),
        showMyJobsOnly,
        isFreelancer,
      ),
    [week2Jobs, userId, crewJobIdSet, isFreelancer, showMyJobsOnly],
  )

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
      conflictTo: null as string | null,
    }
  }, [companyId])

  const { data: projectLeadJobIds = [], isSuccess: projectLeadJobIdsLoaded } =
    useQuery({
      ...projectLeadJobIdsQuery({
        companyId: companyId ?? '',
        userId: userId ?? '',
      }),
      enabled: !!companyId && !!userId,
    })

  const shouldFetchConflicts =
    !!companyId && projectLeadJobIdsLoaded && projectLeadJobIds.length > 0

  const { data: crewConflicts = [], isLoading: crewConflictsLoading } =
    useQuery({
      ...crewConflictsQuery({
        companyId: companyId ?? '',
        from: conflictFrom,
        to: conflictTo,
      }),
      enabled: shouldFetchConflicts,
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
      enabled: shouldFetchConflicts,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })
  const {
    data: equipmentConflicts = [],
    isLoading: equipmentConflictsLoading,
  } = useQuery({
    ...equipmentConflictsQuery({
      companyId: companyId ?? '',
      from: conflictFrom,
      to: conflictTo,
    }),
    enabled: shouldFetchConflicts,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const filteredCrewConflicts = React.useMemo(
    () => filterCrewConflictsByProjectLead(crewConflicts, projectLeadJobIds),
    [crewConflicts, projectLeadJobIds],
  )
  const filteredVehicleConflicts = React.useMemo(
    () =>
      filterVehicleConflictsByProjectLead(vehicleConflicts, projectLeadJobIds),
    [vehicleConflicts, projectLeadJobIds],
  )
  const filteredEquipmentConflicts = React.useMemo(
    () =>
      filterEquipmentConflictsByProjectLead(
        equipmentConflicts,
        projectLeadJobIds,
      ),
    [equipmentConflicts, projectLeadJobIds],
  )

  const conflictsLoading =
    shouldFetchConflicts &&
    (crewConflictsLoading ||
      vehicleConflictsLoading ||
      equipmentConflictsLoading)

  const getInitials = getInitialsFromNameOrEmail

  const getAvatarUrl = (avatarPath: string | null): string | null => {
    if (!avatarPath) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
    return data.publicUrl
  }

  const { data: homeLayoutPrefs } = useQuery({
    ...profileHomeLayoutQuery(userId ?? ''),
    enabled: !!userId && !!companyId,
  })
  const homeLayout = homeLayoutPrefs ?? defaultHomeDashboardLayoutPreferences()

  const conflictsSettled =
    !homeLayout.showConflicts || (projectLeadJobIdsLoaded && !conflictsLoading)

  const isHomeDataLoading =
    mattersLoading ||
    (canVisitJobs && homeLayout.showLatest && companyWeekJobsLoading)

  const showInitialSkeleton = useInitialPageLoad(isHomeDataLoading)

  if (!companyId || showInitialSkeleton) {
    return <HomePageSkeleton />
  }

  if (!isLarge) {
    return (
      <HomeMobileLayout
        userId={userId}
        canVisitJobs={canVisitJobs}
        jobsThisWeek={jobsThisWeek}
        jobsNextWeek={jobsNextWeek}
        jobsWeekAfter={jobsWeekAfter}
        companyWeekJobsLoading={companyWeekJobsLoading}
        companyWeekBookingSummaries={companyWeekBookingSummaries}
        companyWeekBookingsDetailLoading={companyWeekBookingsDetailLoading}
        weekSegment={mobileWeekSegment}
        onWeekSegmentChange={setMobileWeekSegment}
        showMyJobsOnly={showMyJobsOnly}
        onToggleMyJobsOnly={setShowMyJobsOnly}
        isFreelancer={isFreelancer}
        activeRecurringJobs={activeRecurringJobs}
        unreadMatters={unreadMatters}
        mattersLoading={mattersLoading}
        jobsReadyToInvoice={jobsReadyToInvoice}
        jobsReadyToInvoiceLoading={jobsReadyToInvoiceLoading}
        getInitials={getInitials}
        getAvatarUrl={getAvatarUrl}
        crewConflicts={filteredCrewConflicts}
        vehicleConflicts={filteredVehicleConflicts}
        equipmentConflicts={filteredEquipmentConflicts}
        homeLayout={homeLayout}
      />
    )
  }

  return (
    <HomeDesktopLayout
      userId={userId}
      canVisitJobs={canVisitJobs}
      jobsThisWeek={jobsThisWeek}
      jobsNextWeek={jobsNextWeek}
      jobsWeekAfter={jobsWeekAfter}
      companyWeekJobsLoading={companyWeekJobsLoading}
      companyWeekBookingSummaries={companyWeekBookingSummaries}
      companyWeekBookingsDetailLoading={companyWeekBookingsDetailLoading}
      activeRecurringJobs={activeRecurringJobs}
      unreadMatters={unreadMatters}
      mattersLoading={mattersLoading}
      jobsReadyToInvoice={jobsReadyToInvoice}
      jobsReadyToInvoiceLoading={jobsReadyToInvoiceLoading}
      showMyJobsOnly={showMyJobsOnly}
      onToggleMyJobsOnly={setShowMyJobsOnly}
      isFreelancer={isFreelancer}
      getInitials={getInitials}
      getAvatarUrl={getAvatarUrl}
      conflictsSettled={conflictsSettled}
      crewConflicts={filteredCrewConflicts}
      vehicleConflicts={filteredVehicleConflicts}
      equipmentConflicts={filteredEquipmentConflicts}
      homeLayout={homeLayout}
    />
  )
}
