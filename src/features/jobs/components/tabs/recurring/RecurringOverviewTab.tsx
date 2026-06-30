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
import { InfoCircle } from 'iconoir-react'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import {
  recurringJobBookingSummaryQuery,
  recurringJobInvoiceSummaryQuery,
} from '../../../api/recurringJobQueries'
import { getJobStatusColor } from '../../../utils/statusColors'
import type { JobListRow, JobStatus, RecurringJobDetail } from '../../../types'

type Props = {
  detail: RecurringJobDetail
  onSelectJob: (jobId: string) => void
}

const STATUS_ORDER: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
  'canceled',
]

function countByStatus(jobs: Array<JobListRow>) {
  const counts = new Map<JobStatus, number>()
  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1)
  }
  return counts
}

function StatCard({
  label,
  tooltip,
  value,
}: {
  label: string
  tooltip: string
  value: React.ReactNode
}) {
  return (
    <Card size="3" style={{ minHeight: 120 }}>
      <Flex
        direction="column"
        gap="3"
        justify="between"
        style={{ height: '100%' }}
      >
        <Flex align="center" gap="1">
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
        <Text size="7" weight="bold" style={{ lineHeight: 1.1 }}>
          {value}
        </Text>
      </Flex>
    </Card>
  )
}

export default function RecurringOverviewTab({ detail, onSelectJob }: Props) {
  const { data: invoiceSummary = [] } = useQuery({
    ...recurringJobInvoiceSummaryQuery({ recurringJobId: detail.id }),
  })

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

    const invoicedOrPaid =
      (statusCounts.get('invoiced') ?? 0) + (statusCounts.get('paid') ?? 0)

    const totalBookings =
      bookingSummary.reduce((sum, b) => sum + b.crew_count, 0) +
      bookingSummary.reduce((sum, b) => sum + b.equipment_count, 0) +
      bookingSummary.reduce((sum, b) => sum + b.transport_count, 0)

    return {
      statusCounts,
      earliest,
      latest,
      upcoming,
      nextJob,
      needsAttention,
      invoicedOrPaid,
      totalBookings,
    }
  }, [detail.jobs, bookingSummary])

  const statusEntries = STATUS_ORDER.filter((status) =>
    stats.statusCounts.has(status),
  ).map((status) => [status, stats.statusCounts.get(status)!] as const)

  const scheduleValue =
    stats.upcoming.length > 0 ? stats.upcoming.length : stats.earliest ? 0 : '—'

  const scheduleTooltip =
    stats.upcoming.length > 0
      ? `Jobs with a start date in the future. Next: ${stats.nextJob?.title ?? '—'}${stats.nextJob?.start_at ? ` (${format(new Date(stats.nextJob.start_at), 'd. MMM yyyy', { locale: nb })})` : ''}.`
      : stats.earliest && stats.latest
        ? `No upcoming jobs. Series spans ${format(new Date(stats.earliest), 'd. MMM yyyy', { locale: nb })} – ${format(new Date(stats.latest), 'd. MMM yyyy', { locale: nb })}.`
        : 'Jobs in this series that have not been canceled and still have a future start date.'

  return (
    <Flex direction="column" gap="5">
      <Card size="3">
        <Text size="2" weight="medium" mb="2">
          Notes
        </Text>
        {detail.description?.trim() ? (
          <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
            {detail.description}
          </Text>
        ) : (
          <Text size="2" color="gray">
            No notes yet. Add notes when editing the recurring job.
          </Text>
        )}
      </Card>

      <Grid columns={{ initial: '1', sm: '2' }} gap="4">
        <StatCard
          label="Jobs in series"
          tooltip="Total number of individual jobs linked to this recurring job."
          value={detail.job_count}
        />
        <StatCard
          label="Invoiced or paid"
          tooltip="Jobs marked as invoiced or paid — the series is financially closed for these dates."
          value={stats.invoicedOrPaid}
        />
        <StatCard
          label="Booking lines"
          tooltip="Total crew, equipment, and transport booking lines across all jobs in this series."
          value={stats.totalBookings}
        />
        <StatCard
          label="Upcoming jobs"
          tooltip={scheduleTooltip}
          value={scheduleValue}
        />
      </Grid>

      {statusEntries.length > 0 && (
        <Card size="3">
          <Flex align="center" gap="1" mb="3">
            <Text size="2" weight="medium">
              Status breakdown
            </Text>
            <Tooltip content="How many jobs in this series currently have each status.">
              <IconButton
                variant="ghost"
                size="1"
                color="gray"
                style={{ cursor: 'help' }}
                tabIndex={-1}
                aria-label="About status breakdown"
              >
                <InfoCircle width={14} height={14} />
              </IconButton>
            </Tooltip>
          </Flex>
          <Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="3">
            {statusEntries.map(([status, count]) => (
              <Flex
                key={status}
                align="center"
                justify="between"
                gap="3"
                p="3"
                style={{
                  borderRadius: 'var(--radius-3)',
                  background: 'var(--gray-a2)',
                }}
              >
                <Badge
                  color={getJobStatusColor(status)}
                  variant="soft"
                  size="2"
                >
                  {makeWordPresentable(status)}
                </Badge>
                <Text size="4" weight="bold">
                  {count}
                </Text>
              </Flex>
            ))}
          </Grid>
        </Card>
      )}

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
