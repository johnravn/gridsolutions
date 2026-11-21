import { Badge, Flex } from '@radix-ui/themes'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { getJobStatusColor } from '../utils/statusColors'
import type { JobStatus } from '../types'

/** Status badge plus optional green Verified chip (Jobs list). */
export function JobStatusWithVerified({
  displayStatus,
  moneyVerified,
}: {
  displayStatus: JobStatus
  moneyVerified: boolean
}) {
  return (
    <Flex gap="1" align="center" wrap="wrap" style={{ minWidth: 0 }}>
      <Badge
        color={getJobStatusColor(displayStatus)}
        radius="full"
        size="2"
        highContrast
        style={{ width: 'fit-content', whiteSpace: 'nowrap' }}
      >
        {makeWordPresentable(displayStatus)}
      </Badge>
      {moneyVerified ? (
        <Badge color="green" variant="soft" size="1" radius="full">
          Verified
        </Badge>
      ) : null}
    </Flex>
  )
}
