import * as React from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { Calendar, Community, Package, Truck } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns'
import { nb } from 'date-fns/locale'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { useAuthz } from '@shared/auth/useAuthz'
import { getJobStatusColor } from '@features/jobs/utils/statusColors'
import { DashboardCard } from './DashboardCard'
import {
  ScrollToBottomButton,
  useScrollButtonStyles,
} from './ScrollToBottomButton'
import type { WeekJobBookingSummary } from '../api/companyWeekJobsBookingsQuery'
import type { CompanyJobsWeekOffset } from '../api/companyJobsWeekQuery'
import type { JobListRow, JobStatus } from '@features/jobs/types'

function getDisplayStatus(
  status: JobStatus,
  companyRole: string | null,
): JobStatus {
  if (companyRole === 'freelancer') {
    if (status === 'invoiced' || status === 'paid') return 'completed'
  }
  return status
}

const EMPTY_BOOKING: WeekJobBookingSummary = {
  hasEquipment: false,
  hasVehicles: false,
  equipmentByCategory: [],
  vehicleNames: [],
  crewLabels: [],
}

function weekRangeLabel(weekOffset: CompanyJobsWeekOffset): string {
  const base = addWeeks(new Date(), weekOffset)
  const ws = startOfWeek(base, { weekStartsOn: 1 })
  const we = endOfWeek(base, { weekStartsOn: 1 })
  if (ws.getFullYear() === we.getFullYear() && ws.getMonth() === we.getMonth()) {
    return `${format(ws, 'd.', { locale: nb })}–${format(we, 'd. MMM yyyy', { locale: nb })}`
  }
  return `${format(ws, 'd. MMM', { locale: nb })} – ${format(we, 'd. MMM yyyy', { locale: nb })}`
}

function WeekJobBookingRecap({
  summary,
  loading,
}: {
  summary: WeekJobBookingSummary
  loading: boolean
}) {
  if (loading) {
    return (
      <Flex align="center" gap="2" py="1">
        <Spinner size="1" />
        <Text size="1" color="gray">
          Loading bookings…
        </Text>
      </Flex>
    )
  }

  const hasAny =
    summary.hasEquipment ||
    summary.hasVehicles ||
    summary.crewLabels.length > 0

  if (!hasAny) {
    return (
      <Text size="1" color="gray">
        No equipment, vehicles, or extra crew booked yet
      </Text>
    )
  }

  return (
    <Flex direction="column" gap="2" mt="1">
      {(summary.hasEquipment || summary.hasVehicles) && (
        <Flex gap="3" wrap="wrap" align="center">
          {summary.hasEquipment && (
            <Flex align="center" gap="1" style={{ minWidth: 0 }}>
              <Box style={{ flexShrink: 0, color: 'var(--accent-11)' }}>
                <Package width={16} height={16} />
              </Box>
              <Text size="1" color="gray" style={{ minWidth: 0 }}>
                {summary.equipmentByCategory
                  .filter((r) => r.quantity > 0)
                  .map((r) => `${r.quantity}× ${r.categoryName}`)
                  .join(' · ')}
              </Text>
            </Flex>
          )}
          {summary.hasVehicles && (
            <Flex align="center" gap="1" style={{ minWidth: 0 }}>
              <Box style={{ flexShrink: 0, color: 'var(--accent-11)' }}>
                <Truck width={16} height={16} />
              </Box>
              <Text size="1" color="gray" style={{ minWidth: 0 }}>
                {summary.vehicleNames.join(' · ')}
              </Text>
            </Flex>
          )}
        </Flex>
      )}
      {summary.crewLabels.length > 0 && (
        <Flex align="start" gap="1" style={{ minWidth: 0 }}>
          <Box
            style={{
              flexShrink: 0,
              color: 'var(--accent-11)',
              marginTop: 2,
            }}
          >
            <Community width={16} height={16} />
          </Box>
          <Text size="1" color="gray" style={{ minWidth: 0 }}>
            Crew: {summary.crewLabels.join(', ')}
          </Text>
        </Flex>
      )}
    </Flex>
  )
}

export function CompanyJobsWeekSection({
  jobs,
  loading,
  weekOffset,
  onWeekOffsetChange,
  getInitials,
  getAvatarUrl,
  bookingSummaries,
  bookingsDetailLoading,
}: {
  jobs: Array<JobListRow>
  loading: boolean
  weekOffset: CompanyJobsWeekOffset
  onWeekOffsetChange: (offset: CompanyJobsWeekOffset) => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  bookingSummaries: Record<string, WeekJobBookingSummary>
  bookingsDetailLoading: boolean
}) {
  const navigate = useNavigate()
  const { companyRole } = useAuthz()
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  useScrollButtonStyles()

  const title = weekOffset === 0 ? 'Jobs this week' : 'Jobs next week'

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
      fillHeight
      title={title}
      subtitle={weekRangeLabel(weekOffset)}
      icon={<Calendar width={18} height={18} />}
      headerAction={weekToggle}
    >
      {loading ? (
        <Flex align="center" justify="center" py="6" style={{ flex: 1 }}>
          <Spinner size="2" />
        </Flex>
      ) : jobs.length === 0 ? (
        <Flex align="center" justify="center" py="4" style={{ flex: 1 }}>
          <Text size="2" color="gray" align="center">
            {weekOffset === 0
              ? 'No jobs scheduled this week'
              : 'No jobs scheduled next week'}
          </Text>
        </Flex>
      ) : (
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
          <Flex direction="column" gap="3">
            {jobs.map((job) => {
              const customerName =
                job.customer?.name ??
                job.customer_user?.display_name ??
                job.customer_user?.email ??
                '—'
              const leadName =
                job.project_lead?.display_name ||
                job.project_lead?.email ||
                '—'
              const initials = getInitials(
                job.project_lead?.display_name ??
                  job.project_lead?.email ??
                  '',
                job.project_lead?.email ?? '',
              )
              const avatarUrl = getAvatarUrl(
                job.project_lead?.avatar_url ?? null,
              )
              const when =
                job.start_at != null
                  ? format(new Date(job.start_at), 'EEE d. MMM', {
                      locale: nb,
                    })
                  : '—'

              const summary = bookingSummaries[job.id] ?? EMPTY_BOOKING
              const displayStatus = getDisplayStatus(job.status, companyRole)

              return (
                <Card
                  key={job.id}
                  size="2"
                  style={{
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onClick={() =>
                    navigate({
                      to: '/jobs',
                      search: { jobId: job.id, tab: undefined },
                    })
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      '0 0 0 1px var(--gray-a6)'
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
                        <Text size="1" color="gray" mt="1">
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
                    <WeekJobBookingRecap
                      summary={summary}
                      loading={bookingsDetailLoading}
                    />
                  </Flex>
                </Card>
              )
            })}
          </Flex>
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
