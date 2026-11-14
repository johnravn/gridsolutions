import { Badge, Box, Button, Flex, Separator, Text } from '@radix-ui/themes'
import { Link as RouterLink, useNavigate } from '@tanstack/react-router'
import {
  formatConflictPeriod,
  overlapSidesFromPair,
} from '../utils/conflictCopy'
import {
  conflictKindLabel,
  conflictOpenJobs,
  conflictOverlap,
  conflictResourceName,
  conflictStatusLabel,
  conflictWhyCopy,
} from '../utils/conflictItems'
import { formatOverlapDuration } from '../utils/overlapWindow'
import type { CSSProperties } from 'react'
import type { ConflictCardItem } from '../utils/conflictItems'

function BookingSide({
  title,
  startAt,
  endAt,
  forced,
  jobId,
}: {
  title: string
  startAt: string
  endAt: string
  forced?: boolean
  jobId?: string | null
}) {
  const content = (
    <Flex direction="column" gap="1">
      <Flex align="center" gap="2" wrap="wrap">
        <Text size="2" weight="medium">
          {title}
        </Text>
        {forced ? (
          <Badge color="amber" variant="soft">
            Forced
          </Badge>
        ) : null}
      </Flex>
      <Text size="1" color="gray">
        {formatConflictPeriod(startAt, endAt)}
      </Text>
    </Flex>
  )

  const style: CSSProperties = {
    display: 'block',
    padding: 'var(--space-3)',
    borderRadius: 'var(--radius-3)',
    background: 'var(--gray-a3)',
    color: 'inherit',
    textDecoration: 'none',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
  }

  if (jobId) {
    return (
      <RouterLink
        to="/jobs"
        search={{
          jobId,
          recurringJobId: undefined,
          tab: 'bookings',
        }}
        aria-label={`Open ${title}`}
        style={{ ...style, cursor: 'pointer' }}
      >
        {content}
      </RouterLink>
    )
  }

  return <Box style={style}>{content}</Box>
}

function FixActions({ item }: { item: ConflictCardItem }) {
  const navigate = useNavigate()
  const jobs = conflictOpenJobs(item)
  if (jobs.length === 0) {
    return (
      <Text size="2" color="gray">
        This conflict only involves personal bookings — edit them on Calendar or
        the related job Bookings tab.
      </Text>
    )
  }

  return (
    <Flex direction="column" gap="2">
      <Text size="1" color="gray" as="div">
        Fix
      </Text>
      <Flex gap="2" wrap="wrap">
        {jobs.map((job) => (
          <Button key={job.jobId} asChild size="2" variant="solid">
            <RouterLink
              to="/jobs"
              search={{
                jobId: job.jobId,
                recurringJobId: undefined,
                tab: 'bookings',
              }}
              aria-label={`Fix: open ${job.title}`}
            >
              Open {job.title}
            </RouterLink>
          </Button>
        ))}
        {jobs.length >= 2 ? (
          <Button
            size="2"
            variant="soft"
            onClick={() => {
              const [first, ...rest] = jobs
              if (!first) return
              for (const job of rest) {
                window.open(
                  `/jobs?jobId=${encodeURIComponent(job.jobId)}&tab=bookings`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
              void navigate({
                to: '/jobs',
                search: {
                  jobId: first.jobId,
                  recurringJobId: undefined,
                  tab: 'bookings',
                },
              })
            }}
          >
            Open both
          </Button>
        ) : null}
      </Flex>
      <Text size="1" color="gray">
        Resolve by changing assignments on the job Bookings tab.
      </Text>
    </Flex>
  )
}

export default function ConflictInspector({
  item,
  missing = false,
}: {
  item: ConflictCardItem | null
  missing?: boolean
}) {
  if (missing) {
    return <Text color="gray">This conflict is no longer open.</Text>
  }

  if (!item) {
    return <Text color="gray">Select a conflict to see details.</Text>
  }

  const labelColor = item.tone === 'red' ? 'red' : 'amber'
  const overlap = conflictOverlap(item)
  const sides =
    item.kind === 'equipment' ? null : overlapSidesFromPair(item.row)

  return (
    <Flex direction="column" gap="4">
      <Box>
        <Text size="1" weight="medium" color={labelColor} as="div">
          {conflictStatusLabel(item.tone)} · {conflictKindLabel(item.kind)}
        </Text>
        <Text size="5" weight="bold" as="div" mt="1">
          {conflictResourceName(item)}
        </Text>
        <Text size="2" color="gray" as="div" mt="2">
          {conflictWhyCopy(item)}
        </Text>
      </Box>

      <FixActions item={item} />

      {item.kind === 'equipment' ? (
        <Box>
          <Text size="1" color="gray" as="div">
            Capacity
          </Text>
          <Text size="2" as="div">
            {item.row.total_reserved} reserved / {item.row.capacity} available
            {item.row.total_reserved > item.row.capacity
              ? ` (short by ${item.row.total_reserved - item.row.capacity})`
              : ''}
          </Text>
        </Box>
      ) : null}

      <Box>
        <Text size="1" color="gray" as="div">
          Overlap
        </Text>
        {overlap ? (
          <>
            <Text size="2" as="div">
              {formatConflictPeriod(
                overlap.start.toISOString(),
                overlap.end.toISOString(),
              )}
            </Text>
            <Text size="2" weight="medium" as="div">
              {formatOverlapDuration(overlap.durationMs)}
            </Text>
          </>
        ) : (
          <Text size="2" as="div">
            No overlapping time
          </Text>
        )}
      </Box>

      <Separator size="4" />

      <Box>
        <Text size="1" color="gray" as="div" mb="2">
          Affected bookings
        </Text>
        <Flex direction="column" gap="2">
          {item.kind === 'equipment' ? (
            (item.row.job_ids ?? []).length > 0 ? (
              (item.row.job_ids ?? []).map((jobId, index) => (
                <BookingSide
                  key={`${jobId || 'personal'}-${index}`}
                  title={
                    item.row.job_titles?.[index]?.trim() ||
                    (jobId ? 'Untitled job' : 'a personal booking')
                  }
                  startAt={item.row.start_at}
                  endAt={item.row.end_at}
                  forced={item.row.has_forced}
                  jobId={jobId || null}
                />
              ))
            ) : (
              <BookingSide
                title="a personal booking"
                startAt={item.row.start_at}
                endAt={item.row.end_at}
                forced={item.row.has_forced}
              />
            )
          ) : sides ? (
            <>
              <BookingSide
                title={sides[0].title}
                startAt={sides[0].startAt}
                endAt={sides[0].endAt}
                forced={item.row.forced_1}
                jobId={sides[0].jobId}
              />
              <BookingSide
                title={sides[1].title}
                startAt={sides[1].startAt}
                endAt={sides[1].endAt}
                forced={item.row.forced_2}
                jobId={sides[1].jobId}
              />
            </>
          ) : null}
        </Flex>
      </Box>
    </Flex>
  )
}
