import * as React from 'react'
import { Box, Flex, Grid } from '@radix-ui/themes'
import { BibleVerseSection } from './BibleVerseSection'
import { LatestSection } from './LatestSection'
import { MattersSection } from './MattersSection'
import { UpcomingJobsSection } from './UpcomingJobsSection'
import type { HomeMatter, UpcomingJob } from '../types'
import type { ActivityFeedItem } from '@features/latest/types'

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
}: HomeMobileLayoutProps) {
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Grid columns="1fr" gap="4" style={{ height: '100%' }}>
        <Flex direction="column" gap="4" style={{ height: '100%' }}>
          <Box style={{ minHeight: 0 }}>
            <BibleVerseSection />
          </Box>
          {canSeeLatest && (
            <Box style={{ flex: 1, minHeight: '40%' }}>
              <LatestSection
                activities={latestActivities}
                loading={latestLoading}
                onActivityClick={onLatestClick}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
              />
            </Box>
          )}
        </Flex>

        <Flex direction="column" gap="4" style={{ height: '100%' }}>
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
        </Flex>
      </Grid>
    </Box>
  )
}
