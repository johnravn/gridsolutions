import { Box, Flex } from '@radix-ui/themes'
import { ConflictsSection } from '@features/conflicts/components/ConflictsSection'
import { CompanyJobsWeekSection } from './CompanyJobsWeekSection'
import { DailyInspirationSection } from './DailyInspirationSection'
import { JobsReadyToInvoiceSection } from './JobsReadyToInvoiceSection'
import { MattersSection } from './MattersSection'
import { UpcomingJobsSection } from './UpcomingJobsSection'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import type { ConflictDaysFilter } from '@features/conflicts/components/ConflictsSection'
import type { JobListRow } from '@features/jobs/types'
import type { WeekJobBookingSummary } from '../api/companyWeekJobsBookingsQuery'
import type { CompanyJobsWeekOffset } from '../api/companyJobsWeekQuery'
import type { HomeJobReadyToInvoice, HomeMatter, UpcomingJob } from '../types'
import type { HomeDashboardLayoutPreferences } from '../api/profileHomeLayoutQuery'

type HomeMobileLayoutProps = {
  userId: string | null
  canVisitJobs: boolean
  companyWeekJobs: Array<JobListRow>
  companyWeekJobsLoading: boolean
  companyWeekBookingSummaries: Record<string, WeekJobBookingSummary>
  companyWeekBookingsDetailLoading: boolean
  jobsWeekOffset: CompanyJobsWeekOffset
  onJobsWeekOffsetChange: (offset: CompanyJobsWeekOffset) => void
  unreadMatters: Array<HomeMatter>
  mattersLoading: boolean
  jobsReadyToInvoice: Array<HomeJobReadyToInvoice>
  jobsReadyToInvoiceLoading: boolean
  upcomingJobs: Array<UpcomingJob>
  upcomingJobsLoading: boolean
  showMyJobsOnly: boolean
  onToggleMyJobsOnly: (value: boolean) => void
  isFreelancer: boolean
  daysFilter: '7' | '14' | '30' | 'all'
  onDaysFilterChange: (value: '7' | '14' | '30' | 'all') => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  conflictsLoading: boolean
  conflictDaysFilter: ConflictDaysFilter
  onConflictDaysFilterChange: (value: ConflictDaysFilter) => void
  conflictRangeLabel: string
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
  upcomingJobs,
  upcomingJobsLoading,
  showMyJobsOnly,
  onToggleMyJobsOnly,
  isFreelancer,
  daysFilter,
  onDaysFilterChange,
  getInitials,
  getAvatarUrl,
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  conflictsLoading,
  conflictDaysFilter,
  onConflictDaysFilterChange,
  conflictRangeLabel,
  homeLayout,
}: HomeMobileLayoutProps) {
  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <Flex direction="column" gap="4">
        {homeLayout.showDailyInspiration && (
          <Box>
            <DailyInspirationSection userId={userId} />
          </Box>
        )}
        {homeLayout.showMatters && unreadMatters.length > 0 && (
          <Box style={{ minHeight: 0 }}>
            <MattersSection
              matters={unreadMatters}
              loading={mattersLoading}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
            />
          </Box>
        )}
        {canVisitJobs && homeLayout.showLatest && (
          <Box
            style={{
              height: '60vh',
              maxHeight: '60vh',
              minHeight: 0,
              flexShrink: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <CompanyJobsWeekSection
                jobs={companyWeekJobs}
                loading={companyWeekJobsLoading}
                weekOffset={jobsWeekOffset}
                onWeekOffsetChange={onJobsWeekOffsetChange}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
                bookingSummaries={companyWeekBookingSummaries}
                bookingsDetailLoading={companyWeekBookingsDetailLoading}
              />
            </Box>
          </Box>
        )}
        {jobsReadyToInvoice.length > 0 && (
          <Box style={{ minHeight: 0 }}>
            <JobsReadyToInvoiceSection
              jobs={jobsReadyToInvoice}
              loading={jobsReadyToInvoiceLoading}
            />
          </Box>
        )}
        {homeLayout.showConflicts && (
          <Box style={{ minHeight: 0 }}>
            <ConflictsSection
              crewConflicts={crewConflicts}
              vehicleConflicts={vehicleConflicts}
              equipmentConflicts={equipmentConflicts}
              loading={conflictsLoading}
              daysFilter={conflictDaysFilter}
              onDaysFilterChange={onConflictDaysFilterChange}
              rangeLabel={conflictRangeLabel}
            />
          </Box>
        )}
        {homeLayout.showUpcomingJobs && (
          <Box style={{ height: '70dvh', flexShrink: 0 }}>
            <UpcomingJobsSection
              jobs={upcomingJobs}
              loading={upcomingJobsLoading}
              showMyJobsOnly={showMyJobsOnly}
              onToggleMyJobsOnly={onToggleMyJobsOnly}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
              isFreelancer={isFreelancer}
              daysFilter={daysFilter}
              onDaysFilterChange={onDaysFilterChange}
            />
          </Box>
        )}
      </Flex>
    </Box>
  )
}
