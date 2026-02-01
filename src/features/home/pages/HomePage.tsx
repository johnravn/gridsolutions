// src/pages/Home.tsx
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  IconButton,
  Select,
  Spinner,
  Switch,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  GoogleDocs,
  Message,
  RssFeed,
  TransitionLeft,
} from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import {
  getInitialsFromNameOrEmail,
} from '@shared/lib/generalFunctions'
import {
  getModShortcutLabel,
  useModKeyShortcut,
} from '@shared/lib/keyboardShortcuts'
import { formatDistanceToNow } from 'date-fns'
import { jobsIndexQuery } from '@features/jobs/api/queries'
import { latestFeedQuery } from '@features/latest/api/queries'
import { mattersIndexQueryAll } from '@features/matters/api/queries'
import { groupInventoryActivities } from '@features/latest/utils/groupInventoryActivities'
import type {
  ActivityFeedItem,
  GroupedInventoryActivity,
} from '@features/latest/types'

export default function HomePage() {
  const { companyId } = useCompany()
  const { userId, companyRole, caps } = useAuthz()
  const navigate = useNavigate()

  // Calculate date range for upcoming jobs
  const now = new Date()
  const [daysFilter, setDaysFilter] = React.useState<'7' | '14' | '30' | 'all'>(
    '14',
  )

  const dateRangeEnd = React.useMemo(() => {
    if (daysFilter === 'all') return null
    const endDate = new Date(now)
    endDate.setDate(now.getDate() + parseInt(daysFilter, 10))
    return endDate
  }, [daysFilter, now])

  // Fetch upcoming jobs
  const isFreelancer = companyRole === 'freelancer'
  const canSeeLatest = caps.has('visit:latest')
  const [showMyJobsOnly, setShowMyJobsOnly] = React.useState(true)
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '',
      search: '',
      sortBy: 'start_at',
      sortDir: 'asc',
      userId: userId ?? null,
      companyRole: companyRole ?? null,
    }),
    enabled: !!companyId,
  })

  // Filter jobs based on selected date range
  const upcomingJobs = React.useMemo(() => {
    if (!jobsData) return []
    return jobsData.filter((job) => {
      // Always include jobs that are in progress
      if (job.status === 'in_progress') {
        return true
      }

      if (!job.start_at) return false
      const startDate = new Date(job.start_at)
      if (dateRangeEnd === null) {
        // Show all - include future dates and in-progress jobs
        return startDate >= now
      }
      return startDate >= now && startDate <= dateRangeEnd
    })
  }, [jobsData, now, dateRangeEnd])

  type MyJobRole = 'crew' | 'project_lead' | 'both'

  const jobsForCrewLookup = React.useMemo(() => {
    // We display all upcoming jobs, so we need roles for all of them.
    return upcomingJobs
  }, [showMyJobsOnly, upcomingJobs])

  const jobIdsForCrewLookup = React.useMemo(
    () => jobsForCrewLookup.map((j) => j.id),
    [jobsForCrewLookup],
  )

  const { data: crewJobIds = [], isLoading: crewJobIdsLoading } = useQuery({
    queryKey: [
      'home',
      'upcoming-jobs',
      'crew-job-ids',
      companyId,
      userId,
      jobIdsForCrewLookup,
    ],
    queryFn: async (): Promise<Array<string>> => {
      if (!userId) return []
      if (jobIdsForCrewLookup.length === 0) return []

      const { data: timePeriods, error: tpError } = await supabase
        .from('time_periods')
        .select('id, job_id')
        .in('job_id', jobIdsForCrewLookup)

      if (tpError) throw tpError

      const timePeriodIds = timePeriods.map((tp) => tp.id)
      if (timePeriodIds.length === 0) return []

      const { data: crewRes, error: crewError } = await supabase
        .from('reserved_crew')
        .select('time_period_id, status')
        .eq('user_id', userId)
        .in('time_period_id', timePeriodIds)
        .in('status', ['planned', 'confirmed'])

      if (crewError) throw crewError

      const tpJobById = new Map<string, string>()
      timePeriods.forEach((tp) => {
        if (tp.job_id) tpJobById.set(tp.id, tp.job_id)
      })

      const crewJobIdSet = new Set<string>()
      crewRes.forEach((c) => {
        const jobId = tpJobById.get(c.time_period_id)
        if (jobId) crewJobIdSet.add(jobId)
      })

      return Array.from(crewJobIdSet)
    },
    enabled:
      !!companyId &&
      !!userId &&
      jobIdsForCrewLookup.length > 0 &&
      !isFreelancer,
    staleTime: 10_000,
  })

  const crewJobIdSet = React.useMemo(
    () => new Set<string>(crewJobIds),
    [crewJobIds],
  )

  const upcomingJobsWithMyRole = React.useMemo(() => {
    return upcomingJobs.map((job) => {
      const isProjectLead = !!userId && job.project_lead?.user_id === userId
      const isCrew = isFreelancer || crewJobIdSet.has(job.id)

      const my_job_role: MyJobRole | null = isProjectLead
        ? isCrew
          ? 'both'
          : 'project_lead'
        : isCrew
          ? 'crew'
          : null

      return { ...job, my_job_role }
    })
  }, [upcomingJobs, crewJobIdSet, userId])

  // Filter to show only my jobs if toggle is on (but not for freelancers - they're already filtered)
  const filteredUpcomingJobs = React.useMemo(() => {
    // Freelancers are already filtered server-side to only show their booked jobs
    if (isFreelancer) return upcomingJobsWithMyRole
    // For others, respect the toggle
    if (!showMyJobsOnly || !userId) return upcomingJobsWithMyRole
    return upcomingJobsWithMyRole.filter((job) => job.my_job_role !== null)
  }, [upcomingJobsWithMyRole, showMyJobsOnly, userId, isFreelancer])

  const upcomingJobsLoading =
    jobsLoading || (!isFreelancer && showMyJobsOnly && crewJobIdsLoading)

  // Fetch unread matters from all companies
  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    ...mattersIndexQueryAll(),
  })

  const unreadMatters = React.useMemo(() => {
    if (!mattersData) return []
    return mattersData.filter((matter) => matter.is_unread)
  }, [mattersData])

  // Fetch latest activity feed
  const { data: latestData, isLoading: latestLoading } = useQuery({
    ...latestFeedQuery({
      companyId: companyId ?? '',
      limit: 10,
    }),
    enabled: !!companyId && canSeeLatest,
  })

  const handleLatestClick = (activityId: string) => {
    navigate({
      to: '/latest',
      search: { activityId },
    })
  }

  // Using shared getInitialsFromNameOrEmail from generalFunctions
  const getInitials = getInitialsFromNameOrEmail

  const getAvatarUrl = (avatarPath: string | null): string | null => {
    if (!avatarPath) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
    return data.publicUrl
  }

  // Responsive toggle for >= 1024px (large screens)
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )

  // Resize state: track left panel width as percentage (default 50% for 1fr/1fr ratio)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(50)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [savedWidth, setSavedWidth] = React.useState<number>(50)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const rafIdRef = React.useRef<number | null>(null)
  const pendingWidthRef = React.useRef<number | null>(null)

  const toggleMinimize = React.useCallback(() => {
    if (isMinimized) {
      setLeftPanelWidth(savedWidth || 50)
      setIsMinimized(false)
    } else {
      setSavedWidth(leftPanelWidth)
      setIsMinimized(true)
    }
  }, [isMinimized, leftPanelWidth, savedWidth])

  const handleGlowingBarClick = React.useCallback(() => {
    if (isMinimized) {
      setLeftPanelWidth(savedWidth || 50)
      setIsMinimized(false)
    }
  }, [isMinimized, savedWidth])

  const collapseShortcutLabel = getModShortcutLabel('B')
  useModKeyShortcut({ key: 'b', enabled: isLarge, onTrigger: toggleMinimize })

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    // Safari <14 fallback
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // Handle mouse move for resizing
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width

      // Calculate mouse position relative to container
      const mouseX = e.clientX - containerRect.left

      // Calculate new left panel width percentage
      // Min 25%, Max 75% to prevent panels from getting too small
      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )

      // Only update if the value actually changed (prevents unnecessary re-renders)
      pendingWidthRef.current = newWidthPercent

      // Use requestAnimationFrame to batch updates and prevent infinite loops
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (pendingWidthRef.current !== null) {
            setLeftPanelWidth((prev) => {
              // Only update if value actually changed
              if (Math.abs(prev - pendingWidthRef.current!) < 0.1) {
                return prev
              }
              return pendingWidthRef.current!
            })
            pendingWidthRef.current = null
          }
          rafIdRef.current = null
        })
      }
    }

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (pendingWidthRef.current !== null) {
        setLeftPanelWidth((prev) => {
          if (Math.abs(prev - pendingWidthRef.current!) < 0.1) {
            return prev
          }
          return pendingWidthRef.current!
        })
        pendingWidthRef.current = null
      }
      setIsResizing(false)
      // Restore cursor and text selection
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Set global cursor and prevent text selection during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Cleanup in case component unmounts during resize
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      pendingWidthRef.current = null
    }
  }, [isResizing])

  // Inject scroll button animation styles (shared by both UpcomingJobsSection and LatestSection)
  React.useEffect(() => {
    const styleId = 'scroll-button-animation'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes scrollButtonBounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-4px);
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [])

  if (!companyId) {
    return (
      <Box p="4">
        <Text>Please select a company</Text>
      </Box>
    )
  }

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <Box style={{ width: '100%', height: '100%' }}>
        <Grid columns="1fr" gap="4" style={{ height: '100%' }}>
          {/* Left Column: Bible verse and Latest */}
          <Flex direction="column" gap="4" style={{ height: '100%' }}>
            <Box style={{ minHeight: 0 }}>
              <BibleVerseSection />
            </Box>
            {canSeeLatest && (
              <Box style={{ flex: 1, minHeight: '40%' }}>
                <LatestSection
                  activities={latestData?.items || []}
                  loading={latestLoading}
                  onActivityClick={handleLatestClick}
                  getInitials={getInitials}
                  getAvatarUrl={getAvatarUrl}
                />
              </Box>
            )}
          </Flex>

          {/* Right Column: Notifications and Upcoming Jobs */}
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
                jobs={filteredUpcomingJobs}
                loading={upcomingJobsLoading}
                showMyJobsOnly={showMyJobsOnly}
                onToggleMyJobsOnly={setShowMyJobsOnly}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
                isFreelancer={isFreelancer}
                daysFilter={daysFilter}
                onDaysFilterChange={setDaysFilter}
              />
            </Box>
          </Flex>
        </Grid>
      </Box>
    )
  }

  // On large screens, use resizable flex layout
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
        {/* Left Column: Bible verse and Latest */}
        <Flex
          direction="column"
          gap="4"
          style={{
            width: isMinimized ? '60px' : `${leftPanelWidth}%`,
            height: '100%',
            minWidth: isMinimized ? '60px' : '300px',
            maxWidth: isMinimized ? '60px' : '75%',
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isMinimized ? (
            <Box
              onClick={handleGlowingBarClick}
              onMouseEnter={(e) => {
                const bar =
                  e.currentTarget.querySelector<HTMLElement>('[data-glowing-bar]')
                if (bar) bar.style.width = '24px'
              }}
              onMouseLeave={(e) => {
                const bar =
                  e.currentTarget.querySelector<HTMLElement>('[data-glowing-bar]')
                if (bar) bar.style.width = '12px'
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                cursor: 'pointer',
                zIndex: 1,
              }}
            >
              <Box
                data-glowing-bar
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '20px',
                  bottom: '20px',
                  transform: 'translateX(-50%)',
                  width: '12px',
                  borderRadius: '4px',
                  background:
                    'linear-gradient(180deg, var(--accent-9), var(--accent-6))',
                  pointerEvents: 'none',
                  zIndex: 5,
                  transition: 'all 0.2s ease-out',
                  animation: 'glow-pulse 5s ease-in-out infinite',
                }}
              />
              <style>{`
                @keyframes glow-pulse {
                  0%, 100% {
                    box-shadow: 0 0 8px var(--accent-a5), 0 0 12px var(--accent-a4);
                  }
                  50% {
                    box-shadow: 0 0 12px var(--accent-a6), 0 0 18px var(--accent-a5);
                  }
                }
              `}</style>
            </Box>
          ) : (
            <>
              <Box
                style={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}
              >
                <Tooltip
                  content={`Collapse sidebar (${collapseShortcutLabel})`}
                >
                  <IconButton
                    size="3"
                    variant="ghost"
                    onClick={toggleMinimize}
                    style={{ flexShrink: 0 }}
                  >
                    <TransitionLeft width={22} height={22} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box style={{ minHeight: 0 }}>
                <BibleVerseSection />
              </Box>
              {canSeeLatest && (
                <Box style={{ flex: 1, minHeight: '40%' }}>
                  <LatestSection
                    activities={latestData?.items || []}
                    loading={latestLoading}
                    onActivityClick={handleLatestClick}
                    getInitials={getInitials}
                    getAvatarUrl={getAvatarUrl}
                  />
                </Box>
              )}
            </>
          )}
        </Flex>

        {/* RESIZER */}
        {!isMinimized && (
          <Box
            className="section-resizer"
            onMouseDown={(e) => {
              e.preventDefault()
              setIsResizing(true)
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
              margin: '0 -4px', // Extend into gap for easier clicking
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
        )}

        {/* Right Column: Notifications and Upcoming Jobs */}
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
              jobs={filteredUpcomingJobs}
              loading={upcomingJobsLoading}
              showMyJobsOnly={showMyJobsOnly}
              onToggleMyJobsOnly={setShowMyJobsOnly}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
              isFreelancer={isFreelancer}
              daysFilter={daysFilter}
              onDaysFilterChange={setDaysFilter}
            />
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}

function BibleVerseSection() {
  const todayKey = new Date().toISOString().slice(0, 10)
  const langPreference = 'en'

  const { data, isLoading, error } = useQuery({
    queryKey: ['youversion', 'verse-of-the-day', todayKey, langPreference],
    queryFn: async () => {
      const res = await fetch(
        `/api/verse-of-the-day?lang=${encodeURIComponent(langPreference)}`,
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          typeof json?.message === 'string'
            ? json.message
            : 'Failed to load verse of the day',
        )
      }
      return json
    },
    staleTime: 1000 * 60 * 60 * 24, // cache for a day
    gcTime: 1000 * 60 * 60 * 48,
    retry: 1,
  })

  const citation = data?.citation ? String(data.citation) : ''
  const passage = data?.passage ? String(data.passage) : ''
  const version = data?.version ? String(data.version) : ''

  return (
    <DashboardCard
      title="Today's Bible verse"
      icon={<Message width={18} height={18} />}
      notFullHeight
    >
      {isLoading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : error ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            Couldn&apos;t load today&apos;s verse.
          </Text>
        </Box>
      ) : (
        <Flex direction="column" gap="2" py="2">
          <Text weight="bold" size="4">
            {citation || 'Verse of the Day'}
          </Text>
          <Text size="3" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {passage || 'No verse text available.'}
          </Text>
          {version && (
            <Text size="1" color="gray">
              Translation: {version}
            </Text>
          )}
        </Flex>
      )}
    </DashboardCard>
  )
}

function UpcomingJobsSection({
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
  jobs: Array<{
    id: string
    title: string
    status: string
    start_at: string | null
    end_at: string | null
    my_job_role?: 'crew' | 'project_lead' | 'both' | null
    customer?: {
      id: string
      name: string | null
    } | null
    project_lead?: {
      user_id: string
      display_name: string | null
      email: string
      avatar_url: string | null
    } | null
  }>
  loading: boolean
  showMyJobsOnly: boolean
  onToggleMyJobsOnly: (value: boolean) => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  isFreelancer: boolean
  daysFilter: '7' | '14' | '30' | 'all'
  onDaysFilterChange: (value: '7' | '14' | '30' | 'all') => void
}) {
  const navigate = useNavigate()
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  // Check if scrolling is needed - the scrollable parent is DashboardCard's Box (direct parent)
  React.useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        // The scrollable parent is the direct parent (DashboardCard's Box with overflowY: auto)
        const scrollableParent = scrollContainerRef.current.parentElement

        if (scrollableParent) {
          const { scrollTop, scrollHeight, clientHeight } = scrollableParent
          const isScrollable = scrollHeight > clientHeight
          const isNotAtBottom = scrollTop + clientHeight < scrollHeight - 10
          setShowScrollIndicator(isScrollable && isNotAtBottom)
        }
      }
    }

    // Check after a brief delay to ensure DOM is rendered
    const timeoutId = setTimeout(checkScroll, 100)
    const container = scrollContainerRef.current
    if (container) {
      // The scrollable parent is the direct parent (DashboardCard's Box)
      const scrollableParent = container.parentElement

      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', checkScroll)
        window.addEventListener('resize', checkScroll)
        const parent = scrollableParent // Capture for cleanup
        return () => {
          clearTimeout(timeoutId)
          parent.removeEventListener('scroll', checkScroll)
          window.removeEventListener('resize', checkScroll)
        }
      }
    }
    return () => clearTimeout(timeoutId)
  }, [jobs])

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      // The scrollable parent is the direct parent (DashboardCard's Box)
      const scrollableParent = scrollContainerRef.current.parentElement

      if (scrollableParent) {
        scrollableParent.scrollTo({
          top: scrollableParent.scrollHeight,
          behavior: 'smooth',
        })
      }
    }
  }

  const getDaysLabel = (value: '7' | '14' | '30' | 'all') => {
    if (value === 'all') return 'Show all'
    return `Next ${value} days`
  }

  return (
    <DashboardCard
      title="Upcoming Jobs"
      icon={<GoogleDocs width={18} height={18} />}
      headerAction={
        !isFreelancer ? (
          <Flex gap="2" align="center">
            <Select.Root
              value={daysFilter}
              onValueChange={(value) =>
                onDaysFilterChange(value as '7' | '14' | '30' | 'all')
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
            <Flex gap="2" align="center">
              <Text size="1" color="gray">
                My jobs only
              </Text>
              <Switch
                checked={showMyJobsOnly}
                onCheckedChange={onToggleMyJobsOnly}
                size="1"
              />
            </Flex>
          </Flex>
        ) : (
          <Select.Root
            value={daysFilter}
            onValueChange={(value) =>
              onDaysFilterChange(value as '7' | '14' | '30' | 'all')
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
          ref={scrollContainerRef}
          style={{ position: 'relative', height: '100%' }}
        >
          <Flex direction="column" gap="2">
            {jobs.map((job) => {
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
                  ? 'You are crew'
                  : job.my_job_role === 'project_lead'
                    ? 'You are project lead'
                    : job.my_job_role === 'both'
                      ? 'You are project lead + crew'
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
                  style={{
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background-color 0.15s',
                    backgroundColor: 'transparent',
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
                  <Flex gap="2" align="center" justify="between">
                    <Flex
                      direction="column"
                      gap="1"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Flex gap="2" align="center">
                        <Text size="2" weight="medium">
                          {job.title}
                        </Text>
                        {isNotConfirmed && (
                          <Badge size="1" color="yellow" variant="outline">
                            Not confirmed
                          </Badge>
                        )}
                        {myRoleLabel && (
                          <Badge size="1" color={myRoleColor} variant="soft">
                            {myRoleLabel}
                          </Badge>
                        )}
                      </Flex>
                      <Flex gap="2" align="center">
                        <Text size="2" color="gray" weight="medium">
                          {customerName}
                        </Text>
                        <Text size="1" color="gray">
                          •
                        </Text>
                        <Text size="1" color="gray">
                          {job.start_at
                            ? formatDistanceToNow(new Date(job.start_at), {
                                addSuffix: true,
                              })
                            : 'No date set'}
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex gap="2" align="center" style={{ flexShrink: 0 }}>
                      <Flex direction="column" align="end" style={{ lineHeight: 1.2 }}>
                        <Text size="1" color="gray">
                          {displayName}
                        </Text>
                      </Flex>
                      <Avatar
                        size="2"
                        src={avatarUrl || undefined}
                        fallback={initials}
                        radius="full"
                      />
                    </Flex>
                  </Flex>
                </div>
              )
            })}
          </Flex>
          {showScrollIndicator && (
            <Button
              size="1"
              variant="ghost"
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isHovered
                  ? '0 4px 12px rgba(0, 0, 0, 0.2)'
                  : '0 2px 8px rgba(0, 0, 0, 0.15)',
                backgroundColor: isHovered ? 'var(--gray-4)' : 'var(--gray-3)',
                color: 'var(--gray-11)',
                cursor: 'pointer',
                zIndex: 10,
                animation: 'scrollButtonBounce 2s ease-in-out infinite',
                transition:
                  'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
            >
              <ArrowDown width={16} height={16} />
            </Button>
          )}
        </Box>
      )}
    </DashboardCard>
  )
}

function MattersSection({
  matters,
  loading,
  getInitials,
  getAvatarUrl,
}: {
  matters: Array<{
    id: string
    title: string
    matter_type: 'crew_invite' | 'vote' | 'announcement' | 'chat' | 'update'
    created_at: string
    created_by?: {
      user_id: string
      display_name: string | null
      email: string
      avatar_url: string | null
    } | null
  }>
  loading: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
}) {
  const navigate = useNavigate()

  const getMatterTypeLabel = (
    type: 'crew_invite' | 'vote' | 'announcement' | 'chat' | 'update',
  ): string => {
    switch (type) {
      case 'vote':
        return 'Vote'
      case 'chat':
        return 'Chat'
      case 'update':
        return 'Update'
      case 'crew_invite':
        return 'Invite'
      case 'announcement':
        return 'Announcement'
      default:
        return type
    }
  }

  const getMatterTypeColor = (
    type: 'crew_invite' | 'vote' | 'announcement' | 'chat' | 'update',
  ): 'blue' | 'purple' | 'green' | 'orange' => {
    switch (type) {
      case 'vote':
        return 'purple'
      case 'chat':
        return 'blue'
      case 'update':
        return 'blue'
      case 'crew_invite':
        return 'green'
      case 'announcement':
        return 'orange'
      default:
        return 'blue'
    }
  }

  return (
    <DashboardCard
      title="Matters"
      icon={<Message width={18} height={18} />}
      headerAction={
        <Button
          size="2"
          variant="soft"
          onClick={() => navigate({ to: '/matters' })}
        >
          View all
        </Button>
      }
      notFullHeight
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : matters.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No unread matters
          </Text>
        </Box>
      ) : (
        <Flex direction="column" gap="2">
          {matters.slice(0, 5).map((matter) => {
            if (!matter.created_by) return null
            const avatarUrl = getAvatarUrl(matter.created_by.avatar_url)
            const initials = getInitials(
              matter.created_by.display_name,
              matter.created_by.email,
            )

            return (
              <React.Fragment key={matter.id}>
                <div
                  style={{
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background-color 0.15s',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => navigate({ to: '/matters' })}
                >
                  <Flex gap="2" align="center">
                    <Avatar
                      size="2"
                      src={avatarUrl || undefined}
                      fallback={initials}
                      radius="full"
                    />
                    <Box style={{ flex: 1 }}>
                      <Text size="2" weight="medium">
                        {matter.title}
                      </Text>
                      <Flex gap="2" align="center">
                        <Text size="1" color="gray">
                          {matter.created_by.display_name ||
                            matter.created_by.email}
                        </Text>
                        <Text size="1" color="gray">
                          •
                        </Text>
                        <Badge
                          size="1"
                          color={getMatterTypeColor(matter.matter_type)}
                          variant="soft"
                        >
                          {getMatterTypeLabel(matter.matter_type)}
                        </Badge>
                        <Text size="1" color="gray">
                          •
                        </Text>
                        <Text size="1" color="gray">
                          {formatDistanceToNow(new Date(matter.created_at), {
                            addSuffix: true,
                          })}
                        </Text>
                      </Flex>
                    </Box>
                  </Flex>
                </div>
              </React.Fragment>
            )
          })}
        </Flex>
      )}
    </DashboardCard>
  )
}

function LatestSection({
  activities,
  loading,
  onActivityClick,
  getInitials,
  getAvatarUrl,
}: {
  activities: Array<ActivityFeedItem>
  loading: boolean
  onActivityClick: (id: string) => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
}) {
  const navigate = useNavigate()
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  // Group inventory activities
  const groupedActivities = React.useMemo(
    () => groupInventoryActivities(activities),
    [activities],
  )

  // Limit to 10 activities
  const displayActivities = groupedActivities.slice(0, 10)

  // Check if scrolling is needed - the scrollable parent is DashboardCard's Box (direct parent)
  React.useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        // The scrollable parent is the direct parent (DashboardCard's Box with overflowY: auto)
        const scrollableParent = scrollContainerRef.current.parentElement

        if (scrollableParent) {
          const { scrollTop, scrollHeight, clientHeight } = scrollableParent
          const isScrollable = scrollHeight > clientHeight
          const isNotAtBottom = scrollTop + clientHeight < scrollHeight - 10
          setShowScrollIndicator(isScrollable && isNotAtBottom)
        }
      }
    }

    // Check after a brief delay to ensure DOM is rendered
    const timeoutId = setTimeout(checkScroll, 100)
    const container = scrollContainerRef.current
    if (container) {
      // The scrollable parent is the direct parent (DashboardCard's Box)
      const scrollableParent = container.parentElement

      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', checkScroll)
        window.addEventListener('resize', checkScroll)
        const parent = scrollableParent // Capture for cleanup
        return () => {
          clearTimeout(timeoutId)
          parent.removeEventListener('scroll', checkScroll)
          window.removeEventListener('resize', checkScroll)
        }
      }
    }
    return () => clearTimeout(timeoutId)
  }, [displayActivities])

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      // The scrollable parent is the direct parent (DashboardCard's Box)
      const scrollableParent = scrollContainerRef.current.parentElement

      if (scrollableParent) {
        scrollableParent.scrollTo({
          top: scrollableParent.scrollHeight,
          behavior: 'smooth',
        })
      }
    }
  }

  const getActivityIcon = (
    activity: ActivityFeedItem | GroupedInventoryActivity,
  ): { icon: string; bgColor: string } => {
    // Handle grouped inventory activities
    if ('isGrouped' in activity) {
      if (activity.activity_type === 'inventory_items_grouped') {
        return { icon: '📦', bgColor: 'var(--blue-3)' }
      }
      if (activity.activity_type === 'inventory_groups_grouped') {
        return { icon: '📁', bgColor: 'var(--purple-3)' }
      }
      // Mixed (items and groups)
      return { icon: '📦', bgColor: 'var(--blue-3)' }
    }

    // Handle regular activities
    const regularActivity: ActivityFeedItem = activity

    switch (regularActivity.activity_type) {
      case 'inventory_item_created':
      case 'inventory_item_deleted':
        return { icon: '📦', bgColor: 'var(--blue-3)' }
      case 'inventory_group_created':
      case 'inventory_group_deleted':
        return { icon: '📁', bgColor: 'var(--purple-3)' }
      case 'vehicle_added':
      case 'vehicle_removed':
        return { icon: '🚗', bgColor: 'var(--green-3)' }
      case 'customer_added':
      case 'customer_removed':
        return { icon: '👤', bgColor: 'var(--orange-3)' }
      case 'crew_added':
      case 'crew_removed':
        return { icon: '👷', bgColor: 'var(--yellow-3)' }
      case 'job_created':
      case 'job_status_changed':
      case 'job_deleted':
        return { icon: '📋', bgColor: 'var(--indigo-3)' }
      case 'announcement':
        return { icon: '📢', bgColor: 'var(--red-3)' }
      default:
        return { icon: '📌', bgColor: 'var(--gray-3)' }
    }
  }

  const formatActivityTitle = (
    activity: ActivityFeedItem | GroupedInventoryActivity,
  ): string => {
    // Handle grouped inventory activities
    if ('isGrouped' in activity) {
      const parts: Array<string> = []
      if (activity.item_count > 0) {
        parts.push(
          `${activity.item_count} ${activity.item_count === 1 ? 'item' : 'items'}`,
        )
      }
      if (activity.group_count > 0) {
        parts.push(
          `${activity.group_count} ${activity.group_count === 1 ? 'group' : 'groups'}`,
        )
      }
      return `Added ${parts.join(' and ')} to inventory`
    }

    // Handle regular activities
    const regularActivity: ActivityFeedItem = activity
    const metadata = regularActivity.metadata

    switch (regularActivity.activity_type) {
      case 'inventory_item_created':
        return `Added "${metadata.item_name || 'item'}" to inventory`
      case 'inventory_item_deleted':
        return `Removed "${metadata.item_name || 'item'}" from inventory`
      case 'inventory_group_created':
        return `Created inventory group "${metadata.group_name || 'group'}"`
      case 'inventory_group_deleted':
        return `Removed inventory group "${metadata.group_name || 'group'}"`
      case 'vehicle_added':
        return `Added vehicle "${metadata.vehicle_name || metadata.license_plate || 'vehicle'}"`
      case 'vehicle_removed':
        return `Removed vehicle "${metadata.vehicle_name || metadata.license_plate || 'vehicle'}"`
      case 'customer_added':
        return `Added customer "${metadata.customer_name || 'customer'}"`
      case 'customer_removed':
        return `Removed customer "${metadata.customer_name || 'customer'}"`
      case 'crew_added':
        return `Added crew member "${metadata.user_name || metadata.email || 'crew'}"`
      case 'crew_removed':
        return `Removed crew member "${metadata.user_name || metadata.email || 'crew'}"`
      case 'job_created':
        return `Created job "${metadata.job_title || regularActivity.title || 'job'}"`
      case 'job_status_changed':
        return `Changed job "${metadata.job_title || regularActivity.title || 'job'}" status`
      case 'job_deleted':
        return `Deleted job "${metadata.job_title || regularActivity.title || 'job'}"`
      case 'announcement':
        return regularActivity.title || 'Announcement'
      default:
        return regularActivity.title || 'Activity'
    }
  }

  return (
    <DashboardCard
      title="Latest"
      icon={<RssFeed width={18} height={18} />}
      headerAction={
        <Button
          size="2"
          variant="soft"
          onClick={() =>
            navigate({ to: '/latest', search: { activityId: undefined } })
          }
        >
          View all
        </Button>
      }
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : groupedActivities.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No recent activity
          </Text>
        </Box>
      ) : (
        <Box
          ref={scrollContainerRef}
          style={{ position: 'relative', height: '100%' }}
        >
          <Flex direction="column" gap="2">
            {displayActivities.map((activity) => {
              const displayName =
                activity.created_by.display_name || activity.created_by.email
              const avatarUrl = getAvatarUrl(activity.created_by.avatar_url)
              const initials = getInitials(
                activity.created_by.display_name,
                activity.created_by.email,
              )

              return (
                <div
                  key={activity.id}
                  style={{
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background-color 0.15s',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => onActivityClick(activity.id)}
                >
                  <Flex gap="3" align="center" justify="between">
                    <Flex
                      gap="3"
                      align="center"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Text size="3" style={{ flexShrink: 0 }}>
                        {getActivityIcon(activity).icon}
                      </Text>
                      <Flex
                        direction="column"
                        gap="1"
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <Text size="2" weight="medium">
                          {formatActivityTitle(activity)}
                        </Text>
                        <Text size="1" color="gray">
                          {formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                          })}
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex gap="2" align="center" style={{ flexShrink: 0 }}>
                      <Text size="1" color="gray">
                        {displayName}
                      </Text>
                      <Avatar
                        size="2"
                        src={avatarUrl || undefined}
                        fallback={initials}
                        radius="full"
                      />
                    </Flex>
                  </Flex>
                </div>
              )
            })}
          </Flex>
          {showScrollIndicator && (
            <Button
              size="1"
              variant="ghost"
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isHovered
                  ? '0 4px 12px rgba(0, 0, 0, 0.2)'
                  : '0 2px 8px rgba(0, 0, 0, 0.15)',
                backgroundColor: isHovered ? 'var(--gray-4)' : 'var(--gray-3)',
                color: 'var(--gray-11)',
                cursor: 'pointer',
                zIndex: 10,
                animation: 'scrollButtonBounce 2s ease-in-out infinite',
                transition:
                  'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
            >
              <ArrowDown width={16} height={16} />
            </Button>
          )}
        </Box>
      )}
    </DashboardCard>
  )
}

function DashboardCard({
  title,
  icon,
  children,
  footer,
  headerAction,
  notFullHeight,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  headerAction?: React.ReactNode
  notFullHeight?: boolean
}) {
  return (
    <Card size="3" style={notFullHeight ? undefined : { height: '100%' }}>
      <Flex
        direction="column"
        gap="3"
        style={notFullHeight ? undefined : { height: '100%' }}
      >
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <IconBadge>{icon}</IconBadge>
            <Heading size="4">{title}</Heading>
          </Flex>
          {headerAction && <Box>{headerAction}</Box>}
        </Flex>

        <Box
          style={
            notFullHeight
              ? undefined
              : { flex: 1, minHeight: 0, overflowY: 'auto' }
          }
        >
          {children}
        </Box>

        {footer && <Flex justify="end">{footer}</Flex>}
      </Flex>
    </Card>
  )
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <Flex
      align="center"
      justify="center"
      width="32px"
      height="32px"
      style={{
        borderRadius: 8,
        background: 'var(--accent-3)',
        color: 'var(--accent-11)',
      }}
    >
      <Box style={{ lineHeight: 0 }}>{children}</Box>
    </Flex>
  )
}
