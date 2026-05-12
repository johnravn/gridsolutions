import * as React from 'react'
import { Box, Flex } from '@radix-ui/themes'
import { ConflictsSection } from '@features/conflicts/components/ConflictsSection'
import { CompanyJobsWeekSection } from './CompanyJobsWeekSection'
import { DailyInspirationSection } from './DailyInspirationSection'
import { JobsReadyToInvoiceSection } from './JobsReadyToInvoiceSection'
import { MattersSection } from './MattersSection'
import { UpcomingJobsSection } from './UpcomingJobsSection'
import type {
  CrewConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import type { JobListRow } from '@features/jobs/types'
import type { WeekJobBookingSummary } from '../api/companyWeekJobsBookingsQuery'
import type { CompanyJobsWeekOffset } from '../api/companyJobsWeekQuery'
import type { HomeJobReadyToInvoice, HomeMatter, UpcomingJob } from '../types'
import type { HomeDashboardLayoutPreferences } from '../api/profileHomeLayoutQuery'

type HomeDesktopLayoutProps = {
  // Resize state
  containerRef: React.RefObject<HTMLDivElement | null>
  leftPanelWidth: number
  isResizing: boolean
  onResizeStart: (e: React.MouseEvent) => void
  // Content
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
  conflictsLoading: boolean
  homeLayout: HomeDashboardLayoutPreferences
}

export function HomeDesktopLayout({
  containerRef,
  leftPanelWidth,
  isResizing,
  onResizeStart,
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
  conflictsLoading,
  homeLayout,
}: HomeDesktopLayoutProps) {
  return (
    <Box
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        position: 'relative',
      }}
    >
      <Flex
        direction="row"
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
        }}
      >
        <Flex
          direction="column"
          gap="4"
          style={{
            width: `${leftPanelWidth}%`,
            height: '100%',
            minWidth: '300px',
            maxWidth: '75%',
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {homeLayout.showDailyInspiration && (
            <Box style={{ minHeight: 0 }}>
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
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
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
          )}
        </Flex>

        <Box
          className="section-resizer"
          onMouseDown={(e) => {
            e.preventDefault()
            onResizeStart(e)
          }}
          style={{
            width: '6px',
            height: '15%',
            cursor: 'col-resize',
            backgroundColor: 'var(--gray-a4)',
            borderRadius: '4px',
            flexShrink: 0,
            alignSelf: 'center',
            userSelect: 'none',
            margin: '0 -4px',
            zIndex: 10,
            transition: isResizing ? 'none' : 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
              e.currentTarget.style.cursor = 'col-resize'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
            }
          }}
        />

        <Flex
          direction="column"
          gap="4"
          style={{
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            minWidth: '300px',
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
          }}
        >
          {jobsReadyToInvoice.length > 0 && (
            <Box style={{ minHeight: 0 }}>
              <JobsReadyToInvoiceSection
                jobs={jobsReadyToInvoice}
                loading={jobsReadyToInvoiceLoading}
              />
            </Box>
          )}
          {homeLayout.showConflicts &&
            (crewConflicts.length > 0 || vehicleConflicts.length > 0) && (
              <Box style={{ minHeight: 0 }}>
                <ConflictsSection
                  crewConflicts={crewConflicts}
                  vehicleConflicts={vehicleConflicts}
                  loading={conflictsLoading}
                />
              </Box>
            )}
          {homeLayout.showUpcomingJobs && (
            <Box style={{ flex: 2, minHeight: 0 }}>
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
      </Flex>
    </Box>
  )
}
