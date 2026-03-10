import { Box, Flex } from '@radix-ui/themes'
import { ConflictsSection } from '@features/conflicts/components/ConflictsSection'
import { BibleVerseSection } from './BibleVerseSection'
import { LatestSection } from './LatestSection'
import { MattersSection } from './MattersSection'
import { UpcomingJobsSection } from './UpcomingJobsSection'
import type {
  CrewConflictRow,
  VehicleConflictRow,
} from '@features/conflicts/api/queries'
import type { ActivityFeedItem } from '@features/latest/types'
import type { HomeMatter, UpcomingJob } from '../types'

type HomeMobileLayoutProps = {
  canSeeLatest: boolean
  latestActivities: Array<ActivityFeedItem>
  latestLoading: boolean
  onLatestClick: (activityId: string) => void
  unreadMatters: Array<HomeMatter>
  mattersLoading: boolean
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
}

export function HomeMobileLayout({
  canSeeLatest,
  latestActivities,
  latestLoading,
  onLatestClick,
  unreadMatters,
  mattersLoading,
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
        <Box>
          <BibleVerseSection />
        </Box>
        {canSeeLatest && (
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
            <LatestSection
              activities={latestActivities}
              loading={latestLoading}
              onActivityClick={onLatestClick}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
            />
            </Box>
          </Box>
        )}
        {unreadMatters.length > 0 && (
          <Box style={{ minHeight: 0 }}>
            <MattersSection
              matters={unreadMatters}
              loading={mattersLoading}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
            />
          </Box>
        )}
        {(crewConflicts.length > 0 || vehicleConflicts.length > 0) && (
          <Box style={{ minHeight: 0 }}>
            <ConflictsSection
              crewConflicts={crewConflicts}
              vehicleConflicts={vehicleConflicts}
              loading={conflictsLoading}
            />
          </Box>
        )}
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
      </Flex>
    </Box>
  )
}
