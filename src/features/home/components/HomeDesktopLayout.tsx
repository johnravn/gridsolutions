import { Box, Flex } from '@radix-ui/themes'
import { CompanyJobsWeekSection } from './CompanyJobsWeekSection'
import { DailyInspirationSection } from './DailyInspirationSection'
import { HomeAttentionBand } from './HomeAttentionBand'
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

type HomeDesktopLayoutProps = {
  userId: string | null
  canVisitJobs: boolean
  jobsThisWeek: Array<WeekJobWithRole>
  jobsNextWeek: Array<WeekJobWithRole>
  jobsWeekAfter: Array<WeekJobWithRole>
  companyWeekJobsLoading: boolean
  companyWeekBookingSummaries: Record<string, WeekJobBookingSummary>
  companyWeekBookingsDetailLoading: boolean
  activeRecurringJobs: Array<ActiveRecurringJob>
  unreadMatters: Array<HomeMatter>
  mattersLoading: boolean
  jobsReadyToInvoice: Array<HomeJobReadyToInvoice>
  jobsReadyToInvoiceLoading: boolean
  showMyJobsOnly: boolean
  onToggleMyJobsOnly: (value: boolean) => void
  isFreelancer: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  /** False while conflict prefs/data are still resolving (avoids flashing All clear). */
  conflictsSettled: boolean
  crewConflicts: Array<CrewConflictRow>
  vehicleConflicts: Array<VehicleConflictRow>
  equipmentConflicts: Array<EquipmentConflictRow>
  homeLayout: HomeDashboardLayoutPreferences
}

export function HomeDesktopLayout({
  userId,
  canVisitJobs,
  jobsThisWeek,
  jobsNextWeek,
  jobsWeekAfter,
  companyWeekJobsLoading,
  companyWeekBookingSummaries,
  companyWeekBookingsDetailLoading,
  activeRecurringJobs,
  unreadMatters,
  mattersLoading,
  jobsReadyToInvoice,
  jobsReadyToInvoiceLoading,
  showMyJobsOnly,
  onToggleMyJobsOnly,
  isFreelancer,
  getInitials,
  getAvatarUrl,
  conflictsSettled,
  crewConflicts,
  vehicleConflicts,
  equipmentConflicts,
  homeLayout,
}: HomeDesktopLayoutProps) {
  const showInspiration = homeLayout.showDailyInspiration
  const showAttentionBand =
    homeLayout.showMatters || canVisitJobs || homeLayout.showConflicts
  const showTopRow = showInspiration || showAttentionBand
  const showJobs = canVisitJobs && homeLayout.showLatest

  const gridTemplateColumns = showInspiration
    ? showAttentionBand
      ? '1fr 2fr'
      : '1fr'
    : '1fr'

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        position: 'relative',
      }}
    >
      <Flex
        direction="column"
        gap="4"
        style={{
          height: '100%',
          minHeight: 0,
        }}
      >
        {showTopRow && (
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns,
              gap: 'var(--space-4)',
              flexShrink: 0,
              maxHeight: showJobs ? '28%' : undefined,
              minHeight: 0,
              overflow: 'hidden',
              alignItems: 'stretch',
            }}
          >
            {showInspiration && (
              <Box
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  height: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: 'stretch',
                }}
              >
                <DailyInspirationSection userId={userId} />
              </Box>
            )}
            {showAttentionBand && (
              <Box
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  height: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: 'stretch',
                }}
              >
                <HomeAttentionBand
                  showMatters={homeLayout.showMatters}
                  showInvoices={canVisitJobs}
                  showConflicts={homeLayout.showConflicts}
                  unreadMatters={unreadMatters}
                  mattersLoading={mattersLoading}
                  jobsReadyToInvoice={jobsReadyToInvoice}
                  jobsReadyToInvoiceLoading={jobsReadyToInvoiceLoading}
                  crewConflicts={crewConflicts}
                  vehicleConflicts={vehicleConflicts}
                  equipmentConflicts={equipmentConflicts}
                  conflictsSettled={conflictsSettled}
                  getInitials={getInitials}
                  getAvatarUrl={getAvatarUrl}
                />
              </Box>
            )}
          </Box>
        )}

        {showJobs && (
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CompanyJobsWeekSection
              jobsThisWeek={jobsThisWeek}
              jobsNextWeek={jobsNextWeek}
              jobsWeekAfter={jobsWeekAfter}
              loading={companyWeekJobsLoading}
              showMyJobsOnly={showMyJobsOnly}
              onToggleMyJobsOnly={onToggleMyJobsOnly}
              isFreelancer={isFreelancer}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
              bookingSummaries={companyWeekBookingSummaries}
              bookingsDetailLoading={companyWeekBookingsDetailLoading}
              activeRecurringJobs={activeRecurringJobs}
            />
          </Box>
        )}
      </Flex>
    </Box>
  )
}
