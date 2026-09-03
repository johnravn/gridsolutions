import { Box, Button, Flex, Text } from '@radix-ui/themes'
import { Link as RouterLink } from '@tanstack/react-router'
import { overlapSidesFromPair } from '../utils/conflictCopy'
import type { CSSProperties } from 'react'
import type { OverlapSide } from '../utils/conflictCopy'

const buttonStyle = {
  width: '100%',
  height: 'auto',
  paddingTop: 4,
  paddingBottom: 4,
  paddingLeft: 8,
  paddingRight: 8,
  justifyContent: 'flex-start' as const,
  textAlign: 'left' as const,
}

const ellipsis: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
}

function JobLabel({ title, period }: { title: string; period: string }) {
  return (
    <Flex
      direction="column"
      align="start"
      style={{ minWidth: 0, width: '100%' }}
    >
      <Text size="1" weight="medium" style={ellipsis}>
        {title}
      </Text>
      <Text size="1" color="gray" style={ellipsis}>
        {period}
      </Text>
    </Flex>
  )
}

export type ConflictJobButtonItem = {
  jobId: string | null
  title: string
  period: string
}

export function ConflictJobButton({
  jobId,
  title,
  period,
}: ConflictJobButtonItem) {
  const label = <JobLabel title={title} period={period} />

  if (!jobId) {
    return (
      <Box
        px="2"
        py="1"
        style={{
          width: '100%',
          borderRadius: 'var(--radius-2)',
          background: 'var(--gray-a3)',
        }}
      >
        {label}
      </Box>
    )
  }

  return (
    <Button asChild size="1" variant="soft" style={buttonStyle}>
      <RouterLink
        to="/jobs"
        search={{
          jobId,
          recurringJobId: undefined,
          tab: 'bookings',
        }}
        aria-label={`Open job ${title}`}
        style={{ cursor: 'pointer', textDecoration: 'none' }}
      >
        {label}
      </RouterLink>
    </Button>
  )
}

function JobButtonSlot({
  job,
  linkJobs,
  grow,
}: {
  job: ConflictJobButtonItem
  linkJobs: boolean
  grow: boolean
}) {
  return (
    <Box
      style={{
        flex: grow ? 1 : undefined,
        minWidth: grow ? 0 : 132,
        flexShrink: 0,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {linkJobs ? (
        <ConflictJobButton
          jobId={job.jobId}
          title={job.title}
          period={job.period}
        />
      ) : (
        <Box
          px="2"
          py="1"
          style={{
            width: '100%',
            borderRadius: 'var(--radius-2)',
            background: 'var(--gray-a3)',
          }}
        >
          <JobLabel title={job.title} period={job.period} />
        </Box>
      )}
    </Box>
  )
}

export function ConflictJobButtonList({
  jobs,
  linkJobs = true,
}: {
  jobs: Array<ConflictJobButtonItem>
  linkJobs?: boolean
}) {
  const stacked = jobs.length > 2
  const slots = jobs.map((job, index) => (
    <JobButtonSlot
      key={job.jobId ?? `job-${index}`}
      job={job}
      linkJobs={linkJobs}
      grow={!stacked}
    />
  ))

  if (jobs.length > 2) {
    return (
      <Box
        mt="1"
        width="100%"
        data-testid="conflict-job-scroll"
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehavior: 'contain',
          minWidth: 0,
        }}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <Flex direction="row" gap="1" align="stretch" wrap="nowrap">
          {slots}
        </Flex>
      </Box>
    )
  }

  return (
    <Flex direction="row" gap="1" mt="1" width="100%" align="stretch">
      {slots}
    </Flex>
  )
}

export function JobOverlapPair({
  row,
  formatPeriod,
  linkJobs = false,
}: {
  row: {
    job_id_1: string | null
    job_id_2: string | null
    job_title_1: string | null
    job_title_2: string | null
    start_1: string
    end_1: string
    start_2: string
    end_2: string
  }
  formatPeriod: (start: string, end: string) => string
  linkJobs?: boolean
}) {
  const sides: [OverlapSide, OverlapSide] = overlapSidesFromPair(row)
  const jobs = sides.map((side) => ({
    jobId: side.jobId,
    title: side.title,
    period: formatPeriod(side.startAt, side.endAt),
  }))

  return <ConflictJobButtonList jobs={jobs} linkJobs={linkJobs} />
}
