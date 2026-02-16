import * as React from 'react'
import { Box, Flex } from '@radix-ui/themes'
import { BibleVerseSection } from './BibleVerseSection'
import { LatestSection } from './LatestSection'
import { MattersSection } from './MattersSection'
import { UpcomingJobsSection } from './UpcomingJobsSection'
import type { HomeMatter, UpcomingJob } from '../types'
import type { ActivityFeedItem } from '@features/latest/types'

type HomeDesktopLayoutProps = {
  // Resize state
  containerRef: React.RefObject<HTMLDivElement | null>
  leftPanelWidth: number
  isResizing: boolean
  onResizeStart: (e: React.MouseEvent) => void
  // Content
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

export function HomeDesktopLayout({
  containerRef,
  leftPanelWidth,
  isResizing,
  onResizeStart,
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
      </Flex>
    </Box>
  )
}
