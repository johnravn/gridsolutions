import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Card,
  Flex,
  Grid,
  IconButton,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { BoxIso, Car, Clock, Group, InfoCircle } from 'iconoir-react'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { recurringJobBookingSummaryQuery } from '../../../api/recurringJobQueries'
import {
  getJobStatusColor,
  getStatusTimelineColors,
} from '../../../utils/statusColors'
import type { JobListRow, JobStatus, RecurringJobDetail } from '../../../types'

type Props = {
  detail: RecurringJobDetail
  onSelectJob: (jobId: string) => void
}

const JOB_STATUS_FLOW: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
]

function countByStatus(jobs: Array<JobListRow>) {
  const counts = new Map<JobStatus, number>()
  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1)
  }
  return counts
}

type SubStat = {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
}

function SeriesStatusTimeline({
  total,
  statusCounts,
}: {
  total: number
  statusCounts: Map<JobStatus, number>
}) {
  const canceledCount = statusCounts.get('canceled') ?? 0

  return (
    <Card size="3">
      <Flex align="center" justify="between" gap="3" mb="4">
        <Flex align="center" gap="1">
          <Text size="2" weight="medium">
            Jobs in series
          </Text>
          <Tooltip content="How jobs in this recurring series are distributed across each status stage.">
            <IconButton
              variant="ghost"
              size="1"
              color="gray"
              style={{ cursor: 'help' }}
              tabIndex={-1}
              aria-label="About jobs in series"
            >
              <InfoCircle width={14} height={14} />
            </IconButton>
          </Tooltip>
        </Flex>
        <Text size="6" weight="bold" style={{ lineHeight: 1 }}>
          {total}
        </Text>
      </Flex>

      <Box style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <Flex align="start" style={{ minWidth: 520, position: 'relative' }}>
          {JOB_STATUS_FLOW.map((status, idx) => {
            const count = statusCounts.get(status) ?? 0
            const hasJobs = count > 0
            const colors = getStatusTimelineColors(status)
            const nextStatus = JOB_STATUS_FLOW[idx + 1]
            const nextCount = nextStatus
              ? (statusCounts.get(nextStatus) ?? 0)
              : 0
            const nextColors = nextStatus
              ? getStatusTimelineColors(nextStatus)
              : null
            const connectorActive = hasJobs || nextCount > 0

            return (
              <Flex
                key={status}
                direction="column"
                align="center"
                style={{ flex: 1, minWidth: 0, position: 'relative' }}
              >
                {idx < JOB_STATUS_FLOW.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 13,
                      left: 'calc(50% + 14px)',
                      width: 'calc(100% - 28px)',
                      height: 2,
                      background: connectorActive
                        ? nextColors
                          ? `linear-gradient(to right, ${hasJobs ? colors.dotBg : 'var(--gray-a5)'}, ${nextCount > 0 ? nextColors.dotBg : 'var(--gray-a5)'})`
                          : hasJobs
                            ? colors.dotBg
                            : 'var(--gray-a4)'
                        : 'var(--gray-a4)',
                      zIndex: 0,
                      borderRadius: 1,
                    }}
                  />
                )}

                <Tooltip
                  content={`${count} job${count !== 1 ? 's' : ''} at ${makeWordPresentable(status)}`}
                >
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: hasJobs ? colors.dotBg : 'var(--gray-a3)',
                      zIndex: 1,
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  >
                    <Text
                      size="1"
                      weight="bold"
                      style={{
                        color: hasJobs ? 'white' : 'var(--gray-9)',
                        fontSize: count > 9 ? 10 : 11,
                        lineHeight: 1,
                      }}
                    >
                      {count}
                    </Text>
                  </Flex>
                </Tooltip>

                <Text
                  size="1"
                  mt="2"
                  weight={hasJobs ? 'medium' : 'regular'}
                  style={{
                    color: hasJobs ? colors.text : 'var(--gray-9)',
                    textAlign: 'center',
                    fontSize: 10,
                    lineHeight: 1.2,
                    opacity: hasJobs ? 1 : 0.65,
                    wordBreak: 'break-word',
                  }}
                >
                  {makeWordPresentable(status)}
                </Text>
              </Flex>
            )
          })}
        </Flex>
      </Box>

      {canceledCount > 0 && (
        <Flex
          align="center"
          gap="2"
          mt="3"
          pt="3"
          style={{ borderTop: '1px solid var(--gray-a4)' }}
        >
          <Badge color="red" variant="soft" size="1">
            Canceled
          </Badge>
          <Text size="2" weight="medium">
            {canceledCount}
          </Text>
        </Flex>
      )}
    </Card>
  )
}

function StatCard({
  label,
  tooltip,
  value,
  icon,
  subStats = [],
}: {
  label: string
  tooltip: string
  value: React.ReactNode
  icon: React.ReactNode
  subStats?: Array<SubStat>
}) {
  return (
    <Card size="3" style={{ minHeight: 132 }}>
      <Flex
        direction="column"
        gap="3"
        justify="between"
        style={{ height: '100%' }}
      >
        <Flex align="center" justify="between" gap="2">
          <Flex align="center" gap="1" style={{ minWidth: 0 }}>
            <Text size="2" color="gray" weight="medium">
              {label}
            </Text>
            <Tooltip content={tooltip}>
              <IconButton
                variant="ghost"
                size="1"
                color="gray"
                style={{ cursor: 'help' }}
                tabIndex={-1}
                aria-label={`About ${label}`}
              >
                <InfoCircle width={14} height={14} />
              </IconButton>
            </Tooltip>
          </Flex>
          <Flex
            align="center"
            justify="center"
            width="28px"
            height="28px"
            style={{
              flexShrink: 0,
              borderRadius: 6,
              background: 'var(--gray-a3)',
              color: 'var(--gray-11)',
            }}
          >
            <Box style={{ lineHeight: 0 }}>{icon}</Box>
          </Flex>
        </Flex>

        <Text size="7" weight="bold" style={{ lineHeight: 1.1 }}>
          {value}
        </Text>

        {subStats.length > 0 && (
          <Flex gap="2" wrap="wrap">
            {subStats.map((sub) => (
              <Flex
                key={sub.label}
                align="center"
                gap="1"
                px="2"
                py="1"
                style={{
                  borderRadius: 'var(--radius-2)',
                  background: 'var(--gray-a2)',
                }}
              >
                {sub.icon ? (
                  <Box style={{ lineHeight: 0, color: 'var(--gray-9)' }}>
                    {sub.icon}
                  </Box>
                ) : null}
                <Text size="1" color="gray">
                  {sub.label}
                </Text>
                <Text size="1" weight="bold">
                  {sub.value}
                </Text>
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
    </Card>
  )
}

export default function RecurringOverviewTab({ detail, onSelectJob }: Props) {
  const { data: bookingSummary = [] } = useQuery({
    ...recurringJobBookingSummaryQuery({ recurringJobId: detail.id }),
  })

  const stats = React.useMemo(() => {
    const statusCounts = countByStatus(detail.jobs)
    const now = Date.now()

    const datedJobs = detail.jobs
      .filter((j) => j.start_at)
      .sort(
        (a, b) =>
          new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime(),
      )

    const earliest = datedJobs[0]?.start_at ?? null
    const latest = datedJobs[datedJobs.length - 1]?.start_at ?? null

    const upcoming = detail.jobs.filter(
      (j) =>
        j.status !== 'canceled' &&
        j.start_at &&
        new Date(j.start_at).getTime() > now,
    )

    const nextJob = upcoming.sort(
      (a, b) =>
        new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime(),
    )[0]

    const needsAttention = detail.jobs.filter(
      (j) =>
        j.status !== 'invoiced' &&
        j.status !== 'paid' &&
        j.status !== 'canceled' &&
        j.end_at &&
        new Date(j.end_at).getTime() < now,
    )

    const crewBookings = bookingSummary.reduce(
      (sum, b) => sum + b.crew_count,
      0,
    )
    const equipmentBookings = bookingSummary.reduce(
      (sum, b) => sum + b.equipment_count,
      0,
    )
    const transportBookings = bookingSummary.reduce(
      (sum, b) => sum + b.transport_count,
      0,
    )

    const totalBookings = crewBookings + equipmentBookings + transportBookings

    return {
      statusCounts,
      earliest,
      latest,
      upcoming,
      nextJob,
      needsAttention,
      totalBookings,
      crewBookings,
      equipmentBookings,
      transportBookings,
    }
  }, [detail.jobs, bookingSummary])

  const scheduleValue =
    stats.upcoming.length > 0 ? stats.upcoming.length : stats.earliest ? 0 : '—'

  const scheduleTooltip =
    stats.upcoming.length > 0
      ? `Jobs with a start date in the future. Next: ${stats.nextJob?.title ?? '—'}${stats.nextJob?.start_at ? ` (${format(new Date(stats.nextJob.start_at), 'd. MMM yyyy', { locale: nb })})` : ''}.`
      : stats.earliest && stats.latest
        ? `No upcoming jobs. Series spans ${format(new Date(stats.earliest), 'd. MMM yyyy', { locale: nb })} – ${format(new Date(stats.latest), 'd. MMM yyyy', { locale: nb })}.`
        : 'Jobs in this series that have not been canceled and still have a future start date.'

  const nextJobDateLabel = stats.nextJob?.start_at
    ? format(new Date(stats.nextJob.start_at), 'd. MMM', { locale: nb })
    : null

  const hasNotes = Boolean(detail.description?.trim())

  return (
    <Flex direction="column" gap="5">
      {hasNotes && (
        <Card size="3">
          <Text size="2" weight="medium" mb="2">
            Notes
          </Text>
          <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
            {detail.description}
          </Text>
        </Card>
      )}

      <Grid columns={{ initial: '1', sm: '2' }} gap="4">
        <Box style={{ gridColumn: '1 / -1' }}>
          <SeriesStatusTimeline
            total={detail.job_count}
            statusCounts={stats.statusCounts}
          />
        </Box>

        <StatCard
          label="Booking lines"
          tooltip="Total crew, equipment, and transport booking lines across all jobs in this series."
          value={stats.totalBookings}
          icon={<BoxIso width={16} height={16} />}
          subStats={[
            {
              icon: <Group width={12} height={12} />,
              label: 'Crew',
              value: stats.crewBookings,
            },
            {
              icon: <BoxIso width={12} height={12} />,
              label: 'Equipment',
              value: stats.equipmentBookings,
            },
            {
              icon: <Car width={12} height={12} />,
              label: 'Transport',
              value: stats.transportBookings,
            },
          ]}
        />
        <StatCard
          label="Upcoming jobs"
          tooltip={scheduleTooltip}
          value={scheduleValue}
          icon={<Clock width={16} height={16} />}
          subStats={[
            ...(nextJobDateLabel
              ? [{ label: 'Next', value: nextJobDateLabel }]
              : []),
            ...(stats.needsAttention.length > 0
              ? [
                  {
                    label: 'Needs attention',
                    value: stats.needsAttention.length,
                  },
                ]
              : []),
            ...(stats.upcoming.length === 0 &&
            stats.earliest &&
            stats.latest &&
            !nextJobDateLabel
              ? [
                  {
                    label: 'Span',
                    value: `${format(new Date(stats.earliest), 'd. MMM', { locale: nb })} – ${format(new Date(stats.latest), 'd. MMM', { locale: nb })}`,
                  },
                ]
              : []),
          ]}
        />
      </Grid>

      {stats.needsAttention.length > 0 && (
        <Card size="3">
          <Flex align="center" gap="1" mb="1">
            <Text size="2" weight="medium">
              Needs attention
            </Text>
            <Tooltip content="Jobs whose end date has passed but are not yet invoiced, paid, or canceled.">
              <IconButton
                variant="ghost"
                size="1"
                color="gray"
                style={{ cursor: 'help' }}
                tabIndex={-1}
                aria-label="About needs attention"
              >
                <InfoCircle width={14} height={14} />
              </IconButton>
            </Tooltip>
          </Flex>
          <Flex direction="column" gap="2" mt="3">
            {stats.needsAttention.map((job) => (
              <Flex
                key={job.id}
                align="center"
                justify="between"
                gap="3"
                p="3"
                wrap="wrap"
                style={{
                  borderRadius: 'var(--radius-3)',
                  background: 'var(--gray-a2)',
                  cursor: 'pointer',
                }}
                onClick={() => onSelectJob(job.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--gray-a3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                }}
              >
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text size="2" weight="medium">
                    {job.title}
                    {job.jobnr != null ? ` (#${job.jobnr})` : ''}
                  </Text>
                  {job.end_at && (
                    <Text size="1" color="gray" mt="1">
                      Ended{' '}
                      {format(new Date(job.end_at), 'd. MMM yyyy', {
                        locale: nb,
                      })}
                    </Text>
                  )}
                </Box>
                <Badge
                  color={getJobStatusColor(job.status)}
                  variant="soft"
                  size="2"
                >
                  {makeWordPresentable(job.status)}
                </Badge>
              </Flex>
            ))}
          </Flex>
        </Card>
      )}
    </Flex>
  )
}
