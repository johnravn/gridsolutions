import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  HoverCard,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { Calendar, Eye, EyeClosed, User } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns'
import { nb } from 'date-fns/locale'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { useAuthz } from '@shared/auth/useAuthz'
import { getJobStatusColor } from '@features/jobs/utils/statusColors'
import { JobBookingRecap } from '@features/jobs/components/JobBookingRecap'
import { EMPTY_JOB_BOOKING_SUMMARY } from '@features/jobs/utils/bookingSummary'
import DashboardCardSkeleton from '@shared/ui/components/DashboardCardSkeleton'
import { myJobRoleBadge } from '../utils/resolveMyJobRole'
import {
  partitionJobsByWeekSpan,
  weekSpanGridColumn,
} from '../utils/weekJobSpan'
import { DashboardCard } from './DashboardCard'
import {
  HorizontalCardScroller,
  HorizontalScrollCard,
} from './HorizontalCardScroller'
import {
  ScrollToBottomButton,
  useScrollButtonStyles,
} from './ScrollToBottomButton'
import type { WeekJobBookingSummary } from '../api/companyWeekJobsBookingsQuery'
import type { CompanyJobsWeekOffset } from '../api/companyJobsWeekQuery'
import type { ActiveRecurringJob } from '../api/activeRecurringJobsQuery'
import type { JobStatus } from '@features/jobs/types'
import type { MyJobRole, WeekJobWithRole } from '../types'
import type { SpanningJobPlacement } from '../utils/weekJobSpan'

function getDisplayStatus(
  status: JobStatus,
  companyRole: string | null,
): JobStatus {
  if (companyRole === 'freelancer') {
    if (status === 'invoiced' || status === 'paid') return 'completed'
  }
  return status
}

const EMPTY_BOOKING = EMPTY_JOB_BOOKING_SUMMARY

function weekRangeLabel(weekOffset: CompanyJobsWeekOffset): string {
  const base = addWeeks(new Date(), weekOffset)
  const ws = startOfWeek(base, { weekStartsOn: 1 })
  const we = endOfWeek(base, { weekStartsOn: 1 })
  if (
    ws.getFullYear() === we.getFullYear() &&
    ws.getMonth() === we.getMonth()
  ) {
    return `${format(ws, 'd.', { locale: nb })}–${format(we, 'd. MMM yyyy', { locale: nb })}`
  }
  return `${format(ws, 'd. MMM', { locale: nb })} – ${format(we, 'd. MMM yyyy', { locale: nb })}`
}

function weekColumnTitle(weekOffset: CompanyJobsWeekOffset): string {
  if (weekOffset === 0) return 'This week'
  if (weekOffset === 1) return 'Next week'
  return 'In two weeks'
}

function formatJobWhen(
  job: { start_at: string | null; end_at: string | null },
  showRange: boolean,
): string {
  if (job.start_at == null) return '—'
  const start = format(new Date(job.start_at), 'EEE d. MMM', { locale: nb })
  if (!showRange || job.end_at == null) return start
  const end = format(new Date(job.end_at), 'EEE d. MMM', { locale: nb })
  if (start === end) return start
  return `${start} – ${end}`
}

function formatPeriodLabel(
  periodStart: string,
  periodEnd: string | null,
): string {
  const start = format(new Date(`${periodStart}T12:00:00`), 'd. MMM yyyy', {
    locale: nb,
  })
  if (!periodEnd) return `${start} – ongoing`
  const end = format(new Date(`${periodEnd}T12:00:00`), 'd. MMM yyyy', {
    locale: nb,
  })
  return `${start} – ${end}`
}

function InvolvementBadge({ role }: { role: MyJobRole }) {
  const badge = myJobRoleBadge(role)
  if (!badge) return null
  return (
    <Badge size="1" color={badge.color} variant="soft" highContrast>
      {badge.label}
    </Badge>
  )
}

function WeekJobCard({
  job,
  companyRole,
  getInitials,
  getAvatarUrl,
  bookingSummaries,
  bookingsDetailLoading,
  onOpen,
  showDateRange = false,
}: {
  job: WeekJobWithRole
  companyRole: string | null
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  bookingSummaries: Record<string, WeekJobBookingSummary>
  bookingsDetailLoading: boolean
  onOpen: () => void
  showDateRange?: boolean
}) {
  const customerName =
    job.customer?.name ??
    job.customer_user?.display_name ??
    job.customer_user?.email ??
    '—'
  const leadName =
    job.project_lead?.display_name || job.project_lead?.email || '—'
  const initials = getInitials(
    job.project_lead?.display_name ?? job.project_lead?.email ?? '',
    job.project_lead?.email ?? '',
  )
  const avatarUrl = getAvatarUrl(job.project_lead?.avatar_url ?? null)
  const when = formatJobWhen(job, showDateRange)
  const summary = bookingSummaries[job.id] ?? EMPTY_BOOKING
  const displayStatus = getDisplayStatus(job.status, companyRole)

  return (
    <Card
      size="2"
      style={{
        cursor: 'pointer',
        height: '100%',
        flexShrink: 0,
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onClick={onOpen}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 1px var(--gray-a6)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <Flex direction="column" gap="2">
        <Flex gap="2" align="start" justify="between">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Flex gap="2" align="center" wrap="wrap">
              <Text size="3" weight="bold">
                {job.title}
              </Text>
              {job.jobnr != null && (
                <Badge size="1" color="gray" variant="soft">
                  #{job.jobnr}
                </Badge>
              )}
              <Badge
                color={getJobStatusColor(displayStatus)}
                radius="full"
                size="2"
                highContrast
                style={{
                  width: 'fit-content',
                  whiteSpace: 'nowrap',
                }}
              >
                {makeWordPresentable(displayStatus)}
              </Badge>
            </Flex>
            <Text size="1" color="gray" mt="1" as="div">
              {when}
              {' · '}
              {customerName}
              {' · Lead: '}
              {leadName}
            </Text>
          </Box>
          <Avatar
            size="2"
            src={avatarUrl || undefined}
            fallback={initials}
            radius="full"
            style={{ flexShrink: 0 }}
          />
        </Flex>
        <Flex align="end" justify="between" gap="2">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <JobBookingRecap
              summary={summary}
              loading={bookingsDetailLoading}
            />
          </Box>
          <Box style={{ flexShrink: 0 }}>
            <InvolvementBadge role={job.my_job_role} />
          </Box>
        </Flex>
      </Flex>
    </Card>
  )
}

function CompactWeekJobCard({
  job,
  companyRole,
  getInitials,
  getAvatarUrl,
  bookingSummaries,
  bookingsDetailLoading,
  onOpen,
  showDateRange = false,
}: {
  job: WeekJobWithRole
  companyRole: string | null
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  bookingSummaries: Record<string, WeekJobBookingSummary>
  bookingsDetailLoading: boolean
  onOpen: () => void
  showDateRange?: boolean
}) {
  const customerName =
    job.customer?.name ??
    job.customer_user?.display_name ??
    job.customer_user?.email ??
    '—'
  const initials = getInitials(
    job.project_lead?.display_name ?? job.project_lead?.email ?? '',
    job.project_lead?.email ?? '',
  )
  const avatarUrl = getAvatarUrl(job.project_lead?.avatar_url ?? null)
  const when = formatJobWhen(job, showDateRange)
  const summary = bookingSummaries[job.id] ?? EMPTY_BOOKING
  const displayStatus = getDisplayStatus(job.status, companyRole)

  return (
    <Card
      size="2"
      style={{
        cursor: 'pointer',
        flexShrink: 0,
        height: '100%',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onClick={onOpen}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 1px var(--gray-a6)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <Flex direction="column" gap="2">
        <Flex gap="2" align="start" justify="between">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Flex gap="1" align="center" wrap="wrap">
              <Text size="2" weight="bold" style={{ minWidth: 0 }}>
                {job.title}
              </Text>
              <Badge
                color={getJobStatusColor(displayStatus)}
                radius="full"
                size="1"
                highContrast
                style={{ width: 'fit-content', whiteSpace: 'nowrap' }}
              >
                {makeWordPresentable(displayStatus)}
              </Badge>
            </Flex>
            <Text size="1" color="gray" mt="1" as="div">
              {when}
              {' · '}
              {customerName}
            </Text>
          </Box>
          <Avatar
            size="2"
            src={avatarUrl || undefined}
            fallback={initials}
            radius="full"
            style={{ flexShrink: 0 }}
          />
        </Flex>
        <Flex align="end" justify="between" gap="2">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <JobBookingRecap
              summary={summary}
              loading={bookingsDetailLoading}
            />
          </Box>
          <Box style={{ flexShrink: 0 }}>
            <InvolvementBadge role={job.my_job_role} />
          </Box>
        </Flex>
      </Flex>
    </Card>
  )
}

/** Slim multi-week bar — essentials only; HoverCard shows full details (calendar-style). */
function SpanningWeekJobBar({
  job,
  companyRole,
  getInitials,
  getAvatarUrl,
  bookingSummaries,
  bookingsDetailLoading,
  onOpen,
}: {
  job: WeekJobWithRole
  companyRole: string | null
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  bookingSummaries: Record<string, WeekJobBookingSummary>
  bookingsDetailLoading: boolean
  onOpen: () => void
}) {
  const customerName =
    job.customer?.name ??
    job.customer_user?.display_name ??
    job.customer_user?.email ??
    '—'
  const leadName =
    job.project_lead?.display_name || job.project_lead?.email || null
  const initials = getInitials(
    job.project_lead?.display_name ?? job.project_lead?.email ?? '',
    job.project_lead?.email ?? '',
  )
  const avatarUrl = getAvatarUrl(job.project_lead?.avatar_url ?? null)
  const when = formatJobWhen(job, true)
  const summary = bookingSummaries[job.id] ?? EMPTY_BOOKING
  const displayStatus = getDisplayStatus(job.status, companyRole)
  const roleBadge = myJobRoleBadge(job.my_job_role)

  return (
    <HoverCard.Root openDelay={0} closeDelay={100}>
      <HoverCard.Trigger>
        <Box
          onClick={onOpen}
          style={{
            cursor: 'pointer',
            borderRadius: 'var(--radius-2)',
            border: '1px solid var(--gray-a6)',
            // Alpha fill + blur so week separators stay behind without reading through sharply
            background: 'var(--gray-a3)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '6px 10px',
            minWidth: 0,
            position: 'relative',
            zIndex: 1,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-a4)'
            e.currentTarget.style.borderColor = 'var(--gray-a8)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--gray-a3)'
            e.currentTarget.style.borderColor = 'var(--gray-a6)'
          }}
        >
          <Flex align="center" gap="2" style={{ minWidth: 0 }}>
            <Avatar
              size="1"
              src={avatarUrl || undefined}
              fallback={initials}
              radius="full"
              style={{ flexShrink: 0 }}
            />
            <Text
              size="2"
              weight="bold"
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                flexShrink: 1,
              }}
            >
              {job.title}
            </Text>
            <Badge
              color={getJobStatusColor(displayStatus)}
              radius="full"
              size="1"
              highContrast
              style={{ flexShrink: 0 }}
            >
              {makeWordPresentable(displayStatus)}
            </Badge>
            <Box style={{ flex: 1, minWidth: 4 }} />
            <Text size="1" color="gray" style={{ flexShrink: 0 }}>
              {when}
            </Text>
            {roleBadge && (
              <Badge
                size="1"
                color={roleBadge.color}
                variant="soft"
                style={{ flexShrink: 0 }}
              >
                {roleBadge.label}
              </Badge>
            )}
          </Flex>
        </Box>
      </HoverCard.Trigger>
      <HoverCard.Content
        size="1"
        side="bottom"
        minWidth="280px"
        maxWidth="360px"
      >
        <Box p="2">
          <Flex gap="2" align="start" justify="between" mb="2">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text as="div" size="2" weight="bold">
                {job.title}
              </Text>
              {job.jobnr != null && (
                <Text size="1" color="gray" as="div">
                  #{job.jobnr}
                </Text>
              )}
            </Box>
            <Badge
              color={getJobStatusColor(displayStatus)}
              radius="full"
              size="1"
              highContrast
            >
              {makeWordPresentable(displayStatus)}
            </Badge>
          </Flex>
          <Flex direction="column" gap="2">
            <Text size="1">{when}</Text>
            <Text size="1" color="gray">
              {customerName}
            </Text>
            {leadName && (
              <Flex align="center" gap="2">
                <Avatar
                  size="1"
                  radius="full"
                  src={avatarUrl || undefined}
                  fallback={initials}
                  style={{ border: '1px solid var(--gray-a6)' }}
                />
                <Flex direction="column" gap="0">
                  <Text size="1" color="gray">
                    Project lead
                  </Text>
                  <Text size="1" weight="medium">
                    {leadName}
                  </Text>
                </Flex>
              </Flex>
            )}
            {roleBadge && (
              <Badge size="1" color={roleBadge.color} variant="outline">
                {roleBadge.label}
              </Badge>
            )}
            <JobBookingRecap
              summary={summary}
              loading={bookingsDetailLoading}
            />
            <Text size="1" color="gray" mt="1">
              Click to open job
            </Text>
          </Flex>
        </Box>
      </HoverCard.Content>
    </HoverCard.Root>
  )
}

function HiddenSpanningBadge({
  count,
  onShow,
}: {
  count: number
  onShow: () => void
}) {
  const [hovered, setHovered] = React.useState(false)
  const hiddenLabel = `${count} multi-week job${count === 1 ? '' : 's'} hidden`

  return (
    <Button
      size="1"
      variant="ghost"
      color="gray"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onShow}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <span
        style={{
          display: 'inline-grid',
          placeItems: 'center',
        }}
      >
        <span
          style={{
            gridArea: '1 / 1',
            visibility: hovered ? 'hidden' : 'visible',
          }}
        >
          {hiddenLabel}
        </span>
        <span
          style={{
            gridArea: '1 / 1',
            visibility: hovered ? 'visible' : 'hidden',
          }}
        >
          Show
        </span>
      </span>
    </Button>
  )
}

const SPANNING_HIDE_BTN_WIDTH = 32

function SpanningJobsBand({
  spanning,
  showHide,
  companyRole,
  getInitials,
  getAvatarUrl,
  bookingSummaries,
  bookingsDetailLoading,
  onOpenJob,
  onHide,
  onGroupHoverChange,
}: {
  spanning: Array<SpanningJobPlacement<WeekJobWithRole>>
  showHide: boolean
  companyRole: string | null
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  bookingSummaries: Record<string, WeekJobBookingSummary>
  bookingsDetailLoading: boolean
  onOpenJob: (jobId: string) => void
  onHide: () => void
  onGroupHoverChange: (hovered: boolean) => void
}) {
  const [hideBtnHovered, setHideBtnHovered] = React.useState(false)

  return (
    <Flex
      align="stretch"
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
        gap: showHide ? 'var(--space-2)' : 0,
        transition: 'gap 0.2s ease',
      }}
      onMouseEnter={() => onGroupHoverChange(true)}
      onMouseLeave={() => {
        onGroupHoverChange(false)
        setHideBtnHovered(false)
      }}
    >
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: 'var(--space-2) var(--space-4)',
          transition: 'flex-basis 0.2s ease',
        }}
      >
        {spanning.map(({ job, startWeek, endWeek }) => (
          <Box
            key={job.id}
            style={{
              gridColumn: weekSpanGridColumn(startWeek, endWeek),
              minWidth: 0,
            }}
          >
            <SpanningWeekJobBar
              job={job}
              companyRole={companyRole}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
              bookingSummaries={bookingSummaries}
              bookingsDetailLoading={bookingsDetailLoading}
              onOpen={() => onOpenJob(job.id)}
            />
          </Box>
        ))}
      </Box>
      <Box
        role="button"
        tabIndex={showHide ? 0 : -1}
        aria-label="Hide multi-week jobs"
        aria-hidden={!showHide}
        onClick={onHide}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onHide()
          }
        }}
        onMouseEnter={() => setHideBtnHovered(true)}
        onMouseLeave={() => setHideBtnHovered(false)}
        style={{
          flexShrink: 0,
          width: showHide ? SPANNING_HIDE_BTN_WIDTH : 0,
          alignSelf: 'stretch',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-2)',
          border: showHide
            ? '1px solid var(--gray-a6)'
            : '1px solid transparent',
          background: hideBtnHovered ? 'var(--gray-a3)' : 'var(--gray-a2)',
          cursor: showHide ? 'pointer' : 'default',
          opacity: showHide ? 1 : 0,
          overflow: 'hidden',
          pointerEvents: showHide ? 'auto' : 'none',
          transition:
            'width 0.2s ease, opacity 0.15s ease, background 0.15s, border-color 0.15s',
        }}
      >
        <Box
          style={{
            width: SPANNING_HIDE_BTN_WIDTH,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hideBtnHovered ? (
            <EyeClosed width={16} height={16} color="var(--gray-11)" />
          ) : (
            <Eye width={16} height={16} color="var(--gray-11)" />
          )}
        </Box>
      </Box>
    </Flex>
  )
}

function WeekColumn({
  weekOffset,
  jobs,
  loading,
  density,
  companyRole,
  getInitials,
  getAvatarUrl,
  bookingSummaries,
  bookingsDetailLoading,
  onOpenJob,
  hideHeader = false,
}: {
  weekOffset: CompanyJobsWeekOffset
  jobs: Array<WeekJobWithRole>
  loading: boolean
  density: 'full' | 'compact'
  companyRole: string | null
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  bookingSummaries: Record<string, WeekJobBookingSummary>
  bookingsDetailLoading: boolean
  onOpenJob: (jobId: string) => void
  hideHeader?: boolean
}) {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

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

  return (
    <Flex
      direction="column"
      gap="2"
      style={{
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {!hideHeader && (
        <Box>
          <Text size="3" weight="bold" as="div">
            {weekColumnTitle(weekOffset)}
          </Text>
          <Text size="1" color="gray" as="div">
            {weekRangeLabel(weekOffset)}
          </Text>
        </Box>
      )}
      <Box
        ref={parentRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          position: 'relative',
          paddingRight: '4px',
        }}
      >
        {loading ? (
          <DashboardCardSkeleton
            rowCount={density === 'full' ? 5 : 4}
            compact={density === 'compact'}
          />
        ) : jobs.length === 0 ? (
          <Flex align="center" justify="center" py="4" style={{ flex: 1 }}>
            <Text size="2" color="gray" align="center">
              No jobs scheduled
            </Text>
          </Flex>
        ) : (
          <Flex direction="column" gap={density === 'full' ? '3' : '2'}>
            {jobs.map((job) =>
              density === 'full' ? (
                <WeekJobCard
                  key={job.id}
                  job={job}
                  companyRole={companyRole}
                  getInitials={getInitials}
                  getAvatarUrl={getAvatarUrl}
                  bookingSummaries={bookingSummaries}
                  bookingsDetailLoading={bookingsDetailLoading}
                  onOpen={() => onOpenJob(job.id)}
                />
              ) : (
                <CompactWeekJobCard
                  key={job.id}
                  job={job}
                  companyRole={companyRole}
                  getInitials={getInitials}
                  getAvatarUrl={getAvatarUrl}
                  bookingSummaries={bookingSummaries}
                  bookingsDetailLoading={bookingsDetailLoading}
                  onOpen={() => onOpenJob(job.id)}
                />
              ),
            )}
          </Flex>
        )}
        <ScrollToBottomButton
          visible={showScrollIndicator}
          isHovered={isHovered}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={scrollToBottom}
        />
      </Box>
    </Flex>
  )
}

function ActiveRecurringStrip({
  recurringJobs,
  onOpen,
}: {
  recurringJobs: Array<ActiveRecurringJob>
  onOpen: (id: string) => void
}) {
  if (recurringJobs.length === 0) return null

  return (
    <Box
      style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--gray-a5)',
        paddingBottom: 'var(--space-3)',
        marginBottom: 'var(--space-1)',
      }}
    >
      <Text size="1" color="gray" weight="medium" mb="2" as="div">
        Recurring jobs currently going on
      </Text>
      <Flex gap="2" wrap="wrap">
        {recurringJobs.map((rj) => (
          <Badge
            key={rj.id}
            size="2"
            variant="soft"
            color="blue"
            highContrast
            style={{ cursor: 'pointer' }}
            onClick={() => onOpen(rj.id)}
          >
            {rj.title}
            {' · '}
            {formatPeriodLabel(rj.period_start, rj.period_end)}
          </Badge>
        ))}
      </Flex>
    </Box>
  )
}

type DesktopProps = {
  presentation?: 'desktop'
  jobsThisWeek: Array<WeekJobWithRole>
  jobsNextWeek: Array<WeekJobWithRole>
  jobsWeekAfter: Array<WeekJobWithRole>
  loading: boolean
  showMyJobsOnly: boolean
  onToggleMyJobsOnly: (value: boolean) => void
  isFreelancer: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  bookingSummaries: Record<string, WeekJobBookingSummary>
  bookingsDetailLoading: boolean
  activeRecurringJobs?: Array<ActiveRecurringJob>
}

type MobileProps = {
  presentation: 'mobile'
  jobs: Array<WeekJobWithRole>
  loading: boolean
  weekOffset: 0 | 1
  onWeekOffsetChange: (offset: 0 | 1) => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  bookingSummaries: Record<string, WeekJobBookingSummary>
  bookingsDetailLoading: boolean
}

export type CompanyJobsWeekSectionProps = DesktopProps | MobileProps

export function CompanyJobsWeekSection(props: CompanyJobsWeekSectionProps) {
  const navigate = useNavigate()
  const { companyRole } = useAuthz()
  useScrollButtonStyles()

  const openJob = (jobId: string) => {
    navigate({
      to: '/jobs',
      search: { jobId, recurringJobId: undefined, tab: undefined },
    })
  }

  const openRecurringJob = (recurringJobId: string) => {
    navigate({
      to: '/jobs',
      search: { jobId: undefined, recurringJobId, tab: undefined },
    })
  }

  if (props.presentation === 'mobile') {
    const {
      jobs,
      loading,
      weekOffset,
      onWeekOffsetChange,
      getInitials,
      getAvatarUrl,
      bookingSummaries,
      bookingsDetailLoading,
    } = props

    const weekToggle = (
      <Button
        size="2"
        variant="soft"
        onClick={() => onWeekOffsetChange(weekOffset === 0 ? 1 : 0)}
      >
        {weekOffset === 0 ? 'Next week' : 'This week'}
      </Button>
    )

    return (
      <DashboardCard
        notFullHeight
        title="Jobs"
        icon={<Calendar width={18} height={18} />}
        headerAction={weekToggle}
        variant="plain"
      >
        {loading ? (
          <DashboardCardSkeleton rowCount={2} compact />
        ) : jobs.length === 0 ? (
          <Flex align="center" justify="center" py="4" style={{ flex: 1 }}>
            <Text size="2" color="gray" align="center">
              {weekOffset === 0
                ? 'No jobs scheduled this week'
                : 'No jobs scheduled next week'}
            </Text>
          </Flex>
        ) : (
          <HorizontalCardScroller>
            {jobs.map((job) => (
              <HorizontalScrollCard key={job.id} minWidth={280}>
                <WeekJobCard
                  job={job}
                  companyRole={companyRole}
                  getInitials={getInitials}
                  getAvatarUrl={getAvatarUrl}
                  bookingSummaries={bookingSummaries}
                  bookingsDetailLoading={bookingsDetailLoading}
                  onOpen={() => openJob(job.id)}
                />
              </HorizontalScrollCard>
            ))}
          </HorizontalCardScroller>
        )}
      </DashboardCard>
    )
  }

  const {
    jobsThisWeek,
    jobsNextWeek,
    jobsWeekAfter,
    loading,
    showMyJobsOnly,
    onToggleMyJobsOnly,
    isFreelancer,
    getInitials,
    getAvatarUrl,
    bookingSummaries,
    bookingsDetailLoading,
    activeRecurringJobs = [],
  } = props

  const { spanning, singleByWeek } = React.useMemo(
    () => partitionJobsByWeekSpan([jobsThisWeek, jobsNextWeek, jobsWeekAfter]),
    [jobsThisWeek, jobsNextWeek, jobsWeekAfter],
  )

  const [spanningHidden, setSpanningHidden] = React.useState(false)
  const [spanningGroupHovered, setSpanningGroupHovered] = React.useState(false)

  const showSpanningHide = spanningGroupHovered && !spanningHidden
  const showSpanningBand = spanning.length > 0 && !spanningHidden

  const myJobsToggle = !isFreelancer ? (
    <Tooltip
      content={
        showMyJobsOnly
          ? 'Showing your jobs only — click to show all'
          : "Show only jobs you're on"
      }
    >
      <Button
        size="2"
        variant={showMyJobsOnly ? 'solid' : 'soft'}
        highContrast={showMyJobsOnly}
        onClick={() => onToggleMyJobsOnly(!showMyJobsOnly)}
        aria-pressed={showMyJobsOnly}
        aria-label={
          showMyJobsOnly ? 'Show all jobs' : "Show only jobs you're on"
        }
      >
        <User width={16} height={16} />
        My jobs
      </Button>
    </Tooltip>
  ) : undefined

  return (
    <DashboardCard
      notFullHeight
      fillHeight
      title="Jobs"
      icon={<Calendar width={18} height={18} />}
      headerAction={myJobsToggle}
      variant="card"
    >
      <Flex
        direction="column"
        gap="3"
        style={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <ActiveRecurringStrip
          recurringJobs={activeRecurringJobs}
          onOpen={openRecurringJob}
        />

        <Box
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            overflow: 'hidden',
          }}
        >
          {/* Week separators sit behind spanning bars and column content */}
          <Box
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              gap: 'var(--space-4)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <Box
              style={{
                borderRight: '1px solid var(--gray-a5)',
                marginRight: 'calc(var(--space-4) / -2)',
              }}
            />
            <Box
              style={{
                borderRight: '1px solid var(--gray-a5)',
                marginRight: 'calc(var(--space-4) / -2)',
              }}
            />
            <Box />
          </Box>

          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              gap: 'var(--space-4)',
              flexShrink: 0,
              alignItems: 'start',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {([0, 1, 2] as const).map((offset) => (
              <Box key={offset} style={{ minWidth: 0 }}>
                <Text size="3" weight="bold" as="div">
                  {weekColumnTitle(offset)}
                </Text>
                <Text size="1" color="gray" as="div">
                  {weekRangeLabel(offset)}
                </Text>
              </Box>
            ))}
          </Box>

          {spanning.length > 0 && spanningHidden && (
            <Flex
              justify="end"
              style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}
            >
              <HiddenSpanningBadge
                count={spanning.length}
                onShow={() => setSpanningHidden(false)}
              />
            </Flex>
          )}

          {showSpanningBand && (
            <SpanningJobsBand
              spanning={spanning}
              showHide={showSpanningHide}
              companyRole={companyRole}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
              bookingSummaries={bookingSummaries}
              bookingsDetailLoading={bookingsDetailLoading}
              onOpenJob={openJob}
              onHide={() => setSpanningHidden(true)}
              onGroupHoverChange={setSpanningGroupHovered}
            />
          )}

          <Flex
            direction="row"
            gap="4"
            align="stretch"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Box style={{ flex: '2 1 0%', minWidth: 0, minHeight: 0 }}>
              <WeekColumn
                weekOffset={0}
                jobs={singleByWeek[0]}
                loading={loading}
                density="full"
                companyRole={companyRole}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
                bookingSummaries={bookingSummaries}
                bookingsDetailLoading={bookingsDetailLoading}
                onOpenJob={openJob}
                hideHeader
              />
            </Box>
            <Box style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0 }}>
              <WeekColumn
                weekOffset={1}
                jobs={singleByWeek[1]}
                loading={loading}
                density="compact"
                companyRole={companyRole}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
                bookingSummaries={bookingSummaries}
                bookingsDetailLoading={bookingsDetailLoading}
                onOpenJob={openJob}
                hideHeader
              />
            </Box>
            <Box style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0 }}>
              <WeekColumn
                weekOffset={2}
                jobs={singleByWeek[2]}
                loading={loading}
                density="compact"
                companyRole={companyRole}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
                bookingSummaries={bookingSummaries}
                bookingsDetailLoading={bookingsDetailLoading}
                onOpenJob={openJob}
                hideHeader
              />
            </Box>
          </Flex>
        </Box>
      </Flex>
    </DashboardCard>
  )
}
