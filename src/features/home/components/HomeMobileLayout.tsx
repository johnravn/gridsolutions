import { Box, Flex } from '@radix-ui/themes'
import { HomeAttentionSummary } from './HomeAttentionSummary'
import { CompanyJobsWeekSection } from './CompanyJobsWeekSection'
import { DailyInspirationSection } from './DailyInspirationSection'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import type { WeekJobBookingSummary } from '../api/companyWeekJobsBookingsQuery'
import type { ActiveRecurringJob } from '../api/activeRecurringJobsQuery'
import type {
  HomeJobReadyToInvoice,
  HomeMatter,
  WeekJobWithRole,
} from '../types'
import type { HomeDashboardLayoutPreferences } from '../api/profileHomeLayoutQuery'

type MobileWeekSegment = 0 | 1

type HomeMobileLayoutProps = {
  userId: string | null
  canVisitJobs: boolean
  jobsThisWeek: Array<WeekJobWithRole>
  jobsNextWeek: Array<WeekJobWithRole>
  jobsWeekAfter: Array<WeekJobWithRole>
  companyWeekJobsLoading: boolean
  companyWeekBookingSummaries: Record<string, WeekJobBookingSummary>
  companyWeekBookingsDetailLoading: boolean
  weekSegment: MobileWeekSegment
  onWeekSegmentChange: (segment: MobileWeekSegment) => void
  showMyJobsOnly: boolean
  onToggleMyJobsOnly: (value: boolean) => void
  isFreelancer: boolean
  activeRecurringJobs: Array<ActiveRecurringJob>
  unreadMatters: Array<HomeMatter>
  mattersLoading: boolean
  jobsReadyToInvoice: Array<HomeJobReadyToInvoice>
  jobsReadyToInvoiceLoading: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  homeLayout: HomeDashboardLayoutPreferences
}

export function HomeMobileLayout({
  userId,
  canVisitJobs,
  jobsThisWeek,
  jobsNextWeek,
  jobsWeekAfter,
  companyWeekJobsLoading,
  companyWeekBookingSummaries,
  companyWeekBookingsDetailLoading,
  weekSegment,
  onWeekSegmentChange,
  showMyJobsOnly,
  onToggleMyJobsOnly,
  isFreelancer,
  activeRecurringJobs,
  unreadMatters,
  mattersLoading,
  jobsReadyToInvoice,
  jobsReadyToInvoiceLoading,
  getInitials,
  getAvatarUrl,
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  homeLayout,
}: HomeMobileLayoutProps) {
  return (
    <Box
      style={{
        width: '100%',
        minWidth: 0,
      }}
    >
      <Flex
        direction="column"
        gap="7"
        style={{
          minWidth: 0,
          paddingBottom: 40,
        }}
      >
        {homeLayout.showDailyInspiration && (
          <DailyInspirationSection userId={userId} presentation="mobile" />
        )}

        <HomeAttentionSummary
          canVisitJobs={canVisitJobs}
          showMatters={homeLayout.showMatters}
          showConflicts={homeLayout.showConflicts}
          unreadMatters={unreadMatters}
          mattersLoading={mattersLoading}
          crewConflicts={crewConflicts}
          vehicleConflicts={vehicleConflicts}
          equipmentConflicts={equipmentConflicts}
          jobsReadyToInvoice={jobsReadyToInvoice}
          jobsReadyToInvoiceLoading={jobsReadyToInvoiceLoading}
          getInitials={getInitials}
          getAvatarUrl={getAvatarUrl}
        />

        {canVisitJobs && homeLayout.showLatest && (
          <CompanyJobsWeekSection
            presentation="mobile"
            jobsThisWeek={jobsThisWeek}
            jobsNextWeek={jobsNextWeek}
            jobsWeekAfter={jobsWeekAfter}
            loading={companyWeekJobsLoading}
            weekSegment={weekSegment}
            onWeekSegmentChange={onWeekSegmentChange}
            showMyJobsOnly={showMyJobsOnly}
            onToggleMyJobsOnly={onToggleMyJobsOnly}
            isFreelancer={isFreelancer}
            activeRecurringJobs={activeRecurringJobs}
            getInitials={getInitials}
            getAvatarUrl={getAvatarUrl}
            bookingSummaries={companyWeekBookingSummaries}
            bookingsDetailLoading={companyWeekBookingsDetailLoading}
          />
        )}
      </Flex>
    </Box>
  )
}
