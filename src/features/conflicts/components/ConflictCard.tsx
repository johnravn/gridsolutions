import { Box, Text } from '@radix-ui/themes'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import {
  formatOverlapDuration,
  overlapHoursBetweenPeriods,
} from '../api/overlapChecks'
import type { OverlapConflict } from '../api/overlapChecks'

function formatPeriod(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  return `${format(s, 'd. MMM yyyy HH:mm', { locale: nb })} – ${format(e, 'd. MMM yyyy HH:mm', { locale: nb })}`
}

export function ConflictCard({
  conflict,
  jobPeriodStart,
  jobPeriodEnd,
}: {
  conflict: OverlapConflict
  jobPeriodStart?: string
  jobPeriodEnd?: string
}) {
  const overlapLabel =
    jobPeriodStart && jobPeriodEnd
      ? formatOverlapDuration(
          overlapHoursBetweenPeriods(
            jobPeriodStart,
            jobPeriodEnd,
            conflict.startAt,
            conflict.endAt,
          ),
        )
      : null

  return (
    <Box
      p="2"
      style={{
        borderRadius: 8,
        backgroundColor: 'var(--gray-a2)',
        border: '1px solid var(--gray-a5)',
      }}
    >
      {conflict.itemName ? (
        <Text size="2" weight="medium" as="div">
          {conflict.itemName}
          {conflict.quantity != null ? ` × ${conflict.quantity}` : ''}
        </Text>
      ) : null}
      <Text size="2" weight="medium" as="div">
        {conflict.jobTitle ?? 'Personal / other booking'}
      </Text>
      <Text size="1" color="gray" as="div" mt="1">
        {formatPeriod(conflict.startAt, conflict.endAt)}
      </Text>
      {overlapLabel ? (
        <Text size="1" color="gray" as="div">
          {overlapLabel}
        </Text>
      ) : null}
      {conflict.customerName ? (
        <Text size="1" color="gray" as="div">
          Customer: {conflict.customerName}
        </Text>
      ) : null}
      {conflict.projectLeadName ? (
        <Text size="1" color="gray" as="div">
          Project lead: {conflict.projectLeadName}
        </Text>
      ) : null}
    </Box>
  )
}
