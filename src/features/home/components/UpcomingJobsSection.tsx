import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Select,
  Spinner,
  Switch,
  Text,
} from '@radix-ui/themes'
import { GoogleDocs } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useVirtualizer } from '@tanstack/react-virtual'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { DashboardCard } from './DashboardCard'
import {
  ScrollToBottomButton,
  useScrollButtonStyles,
} from './ScrollToBottomButton'
import type { DaysFilter, UpcomingJob } from '../types'

function getDaysLabel(value: DaysFilter) {
  if (value === 'all') return 'Show all'
  return `Next ${value} days`
}

export function UpcomingJobsSection({
  jobs,
  loading,
  showMyJobsOnly,
  onToggleMyJobsOnly,
  getInitials,
  getAvatarUrl,
  isFreelancer,
  daysFilter,
  onDaysFilterChange,
}: {
  jobs: Array<UpcomingJob>
  loading: boolean
  showMyJobsOnly: boolean
  onToggleMyJobsOnly: (value: boolean) => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  isFreelancer: boolean
  daysFilter: DaysFilter
  onDaysFilterChange: (value: DaysFilter) => void
}) {
  const navigate = useNavigate()
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)
  const isMobile = !useMediaQuery('(min-width: 1024px)')

  useScrollButtonStyles()

  const rowHeight = isMobile ? 112 : 72
  const rowGap = isMobile ? 16 : 8

  const rowVirtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
    gap: rowGap,
    getItemKey: (index) => jobs[index]?.id ?? index,
    enabled: jobs.length > 0,
  })

  React.useEffect(() => {
    const checkScroll = () => {
      if (parentRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = parentRef.current
        const isScrollable = scrollHeight > clientHeight
        const isNotAtBottom = scrollTop + clientHeight < scrollHeight - 10
        setShowScrollIndicator(isScrollable && isNotAtBottom)
      }
    }

    const timeoutId = setTimeout(checkScroll, 100)
    const container = parentRef.current
    if (container) {
      container.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
      return () => {
        clearTimeout(timeoutId)
        container.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
    return () => clearTimeout(timeoutId)
  }, [jobs])

  const scrollToBottom = () => {
    if (parentRef.current) {
      parentRef.current.scrollTo({
        top: parentRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  const daysFilterSelect = (
    <Select.Root
      value={daysFilter}
      onValueChange={(value) =>
        onDaysFilterChange(value as DaysFilter)
      }
    >
      <Select.Trigger variant="soft" style={{ minWidth: '120px' }}>
        {getDaysLabel(daysFilter)}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="7">Next 7 days</Select.Item>
        <Select.Item value="14">Next 14 days</Select.Item>
        <Select.Item value="30">Next 30 days</Select.Item>
        <Select.Item value="all">Show all</Select.Item>
      </Select.Content>
    </Select.Root>
  )

  return (
    <DashboardCard
      title="Upcoming Jobs"
      icon={<GoogleDocs width={18} height={18} />}
      headerAction={
        !isFreelancer ? (
          <Flex
            gap={isMobile ? '3' : '2'}
            direction={isMobile ? 'column' : 'row'}
            align={isMobile ? 'end' : 'center'}
          >
            {daysFilterSelect}
            <Flex gap="2" align="center">
              <Text size="1" color="gray">
                {isMobile ? 'My jobs' : 'My jobs only'}
              </Text>
              <Switch
                checked={showMyJobsOnly}
                onCheckedChange={onToggleMyJobsOnly}
                size="1"
              />
            </Flex>
          </Flex>
        ) : (
          daysFilterSelect
        )
      }
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : jobs.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            {isFreelancer
              ? `No jobs booked ${daysFilter === 'all' ? '' : `in the next ${daysFilter} days`}`
              : `No upcoming jobs ${daysFilter === 'all' ? '' : `in the next ${daysFilter} days`}`}
          </Text>
        </Box>
      ) : (
        <Box
          style={{
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <Box
            ref={parentRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const job = jobs[virtualRow.index]
                const avatarUrl = getAvatarUrl(
                  job.project_lead?.avatar_url ?? null,
                )
                const displayName =
                  job.project_lead?.display_name ||
                  job.project_lead?.email ||
                  'Unassigned'
                const initials = getInitials(
                  job.project_lead?.display_name ?? null,
                  job.project_lead?.email ?? '',
                )
                const customerName = job.customer?.name || 'No customer'
                const myRoleLabel =
                  job.my_job_role === 'crew'
                    ? 'Crew'
                    : job.my_job_role === 'project_lead'
                      ? 'Lead'
                      : job.my_job_role === 'both'
                        ? 'Lead + Crew'
                        : null
                const myRoleColor =
                  job.my_job_role === 'both'
                    ? 'purple'
                    : job.my_job_role === 'project_lead'
                      ? 'blue'
                      : job.my_job_role === 'crew'
                        ? 'orange'
                        : 'gray'
                const isNotConfirmed =
                  job.status === 'planned' || job.status === 'requested'

                return (
                  <div
                    key={job.id}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      style={{
                        cursor: 'pointer',
                        padding: isMobile ? '14px 14px 20px 14px' : '8px',
                        borderRadius: isMobile ? '12px' : '8px',
                        ...(isMobile &&
                          virtualRow.index < jobs.length - 1 && {
                            borderBottom:
                              '1px solid var(--gray-a5)',
                          }),
                        transition: 'background-color 0.15s',
                        backgroundColor: 'transparent',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                      onClick={() =>
                        navigate({
                          to: '/jobs',
                          search: { jobId: job.id, tab: undefined },
                        })
                      }
                    >
                        <Flex
                          gap={isMobile ? '3' : '2'}
                          align="center"
                          justify="between"
                          direction="row"
                          style={{ width: '100%', minWidth: 0 }}
                        >
                          <Flex
                            direction="column"
                            gap={isMobile ? '2' : '1'}
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            {isMobile ? (
                              <>
                                <Text
                                  size="3"
                                  weight="medium"
                                  style={{ lineHeight: 1.3 }}
                                >
                                  {job.title}
                                </Text>
                            </>
                          ) : (
                            <Text size="2" weight="medium">
                              {job.title}
                            </Text>
                          )}
                          <Flex
                            gap="2"
                            direction={isMobile ? 'column' : 'row'}
                            align={isMobile ? 'start' : 'center'}
                          >
                            <Text size="2" color="gray" weight="medium">
                              {customerName}
                            </Text>
                            {!isMobile && (
                              <Text size="1" color="gray">
                                •
                              </Text>
                            )}
                            <Text size="1" color="gray">
                              {job.start_at
                                ? format(new Date(job.start_at), 'd. MMM yyyy', {
                                    locale: nb,
                                  })
                                : 'No date set'}
                            </Text>
                          </Flex>
                        </Flex>
                        <Flex
                          gap="2"
                          align="center"
                          direction={isMobile ? 'column' : 'row'}
                          style={{ flexShrink: 0 }}
                        >
                          {isMobile ? (
                            <Flex gap="2" align="center">
                              <Flex
                                direction="column"
                                align="end"
                                gap="1"
                                style={{ lineHeight: 1.2 }}
                              >
                                <Text size="1" color="gray">
                                  {displayName}
                                </Text>
                                {(isNotConfirmed || myRoleLabel) && (
                                  <Flex
                                    gap="2"
                                    align="center"
                                    justify="end"
                                    wrap="wrap"
                                  >
                                    {isNotConfirmed && (
                                      <Badge
                                        size="1"
                                        color="yellow"
                                        variant="outline"
                                      >
                                        Not confirmed
                                      </Badge>
                                    )}
                                    {myRoleLabel && (
                                      <Badge
                                        size="1"
                                        color={myRoleColor}
                                        variant="soft"
                                      >
                                        {myRoleLabel}
                                      </Badge>
                                    )}
                                  </Flex>
                                )}
                              </Flex>
                              <Avatar
                                size="3"
                                src={avatarUrl || undefined}
                                fallback={initials}
                                radius="full"
                              />
                            </Flex>
                          ) : (
                            <Flex gap="2" align="center">
                              <Flex
                                direction="column"
                                align="end"
                                gap="1"
                                style={{ lineHeight: 1.2 }}
                              >
                                <Text size="1" color="gray">
                                  {displayName}
                                </Text>
                                {(isNotConfirmed || myRoleLabel) && (
                                  <Flex
                                    gap="2"
                                    align="center"
                                    justify="end"
                                    wrap="wrap"
                                  >
                                    {isNotConfirmed && (
                                      <Badge
                                        size="1"
                                        color="yellow"
                                        variant="outline"
                                      >
                                        Not confirmed
                                      </Badge>
                                    )}
                                    {myRoleLabel && (
                                      <Badge
                                        size="1"
                                        color={myRoleColor}
                                        variant="soft"
                                      >
                                        {myRoleLabel}
                                      </Badge>
                                    )}
                                  </Flex>
                                )}
                              </Flex>
                              <Avatar
                                size="2"
                                src={avatarUrl || undefined}
                                fallback={initials}
                                radius="full"
                              />
                            </Flex>
                          )}
                        </Flex>
                      </Flex>
                    </div>
                  </div>
                )
              })}
            </div>
          </Box>
          <ScrollToBottomButton
            visible={showScrollIndicator}
            isHovered={isHovered}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={scrollToBottom}
          />
        </Box>
      )}
    </DashboardCard>
  )
}
