import { Box, Flex } from '@radix-ui/themes'
import { HomeAttentionSummary } from './HomeAttentionSummary'
import { CompanyJobsWeekSection } from './CompanyJobsWeekSection'
import { DailyInspirationSection } from './DailyInspirationSection'
import { MattersSection } from './MattersSection'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import type { ConflictDaysFilter } from '@features/conflicts/components/ConflictsSection'
import type { WeekJobBookingSummary } from '../api/companyWeekJobsBookingsQuery'
import type {
  HomeJobReadyToInvoice,
  HomeMatter,
  WeekJobWithRole,
} from '../types'
import type { HomeDashboardLayoutPreferences } from '../api/profileHomeLayoutQuery'

type HomeMobileLayoutProps = {
  userId: string | null
  canVisitJobs: boolean
  companyWeekJobs: Array<WeekJobWithRole>
  companyWeekJobsLoading: boolean
  companyWeekBookingSummaries: Record<string, WeekJobBookingSummary>
  companyWeekBookingsDetailLoading: boolean
  jobsWeekOffset: 0 | 1
  onJobsWeekOffsetChange: (offset: 0 | 1) => void
  unreadMatters: Array<HomeMatter>
  mattersLoading: boolean
  jobsReadyToInvoice: Array<HomeJobReadyToInvoice>
  jobsReadyToInvoiceLoading: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  conflictDaysFilter: ConflictDaysFilter
  onConflictDaysFilterChange: (value: ConflictDaysFilter) => void
  homeLayout: HomeDashboardLayoutPreferences
}

export function HomeMobileLayout({
  userId,
  canVisitJobs,
  companyWeekJobs,
  companyWeekJobsLoading,
  companyWeekBookingSummaries,
  companyWeekBookingsDetailLoading,
  jobsWeekOffset,
  onJobsWeekOffsetChange,
  unreadMatters,
  mattersLoading,
  jobsReadyToInvoice,
  jobsReadyToInvoiceLoading,
  getInitials,
  getAvatarUrl,
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  conflictDaysFilter,
  onConflictDaysFilterChange,
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
        gap="6"
        style={{
          minWidth: 0,
          paddingBottom: 24,
        }}
      >
        {homeLayout.showDailyInspiration && (
          <DailyInspirationSection userId={userId} presentation="mobile" />
        )}

        <HomeAttentionSummary
          canVisitJobs={canVisitJobs}
          showConflicts={homeLayout.showConflicts}
          crewConflicts={crewConflicts}
          vehicleConflicts={vehicleConflicts}
          equipmentConflicts={equipmentConflicts}
          conflictDaysFilter={conflictDaysFilter}
          onConflictDaysFilterChange={onConflictDaysFilterChange}
          jobsReadyToInvoice={jobsReadyToInvoice}
          jobsReadyToInvoiceLoading={jobsReadyToInvoiceLoading}
        />

        {homeLayout.showMatters && unreadMatters.length > 0 && (
          <MattersSection
            matters={unreadMatters}
            loading={mattersLoading}
            getInitials={getInitials}
            getAvatarUrl={getAvatarUrl}
            presentation="mobile"
          />
        )}

        {canVisitJobs && homeLayout.showLatest && (
          <CompanyJobsWeekSection
            presentation="mobile"
            jobs={companyWeekJobs}
            loading={companyWeekJobsLoading}
            weekOffset={jobsWeekOffset}
            onWeekOffsetChange={onJobsWeekOffsetChange}
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
