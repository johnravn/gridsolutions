import { useQuery } from '@tanstack/react-query'
import { Box, Button, Flex, Text } from '@radix-ui/themes'
import { Download } from 'iconoir-react'
import { jobTimePeriodsQuery } from '@features/jobs/api/queries'
import { TimelineBlock } from '../../pretty-offer/TimelineBlock'
import { mapProgramPeriodsToTimelineItems } from '../../../utils/programTimeline'
import { createTempId } from './types'
import type { LocalContentBlock } from './types'

type Props = {
  block: LocalContentBlock
  jobId: string
  readOnly: boolean
  onImport: (items: LocalContentBlock['items']) => void
}

export function TimelineBlockEditor({
  block,
  jobId,
  readOnly,
  onImport,
}: Props) {
  const { data: timePeriods = [], isLoading } = useQuery(
    jobTimePeriodsQuery({ jobId }),
  )

  const handleImport = () => {
    const items = mapProgramPeriodsToTimelineItems(block.id, timePeriods, () =>
      createTempId('block-item'),
    )
    onImport(items)
  }

  return (
    <Flex direction="column" gap="3">
      <Text size="2" color="gray">
        Imports a snapshot of the job program timeline. Changes to the job
        program after import will not affect this offer.
      </Text>

      {!readOnly && (
        <Box>
          <Button
            size="2"
            variant="soft"
            disabled={isLoading}
            onClick={handleImport}
          >
            <Download width={16} height={16} />
            {block.items.length > 0
              ? 'Re-import from program'
              : 'Import from program'}
          </Button>
        </Box>
      )}

      {block.items.length > 0 ? (
        <TimelineBlock items={block.items} />
      ) : (
        <Text size="2" color="gray">
          No timeline imported yet.
          {!readOnly && ' Click import to copy the current program schedule.'}
        </Text>
      )}
    </Flex>
  )
}
