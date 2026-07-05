import { useQuery } from '@tanstack/react-query'
import { Box, Button, Flex, Heading, Text, TextField } from '@radix-ui/themes'
import { Download } from 'iconoir-react'
import { jobTimePeriodsQuery } from '@features/jobs/api/queries'
import { TimelineBlock } from '../../pretty-offer/TimelineBlock'
import { mapProgramPeriodsToTimelineItems } from '../../../utils/programTimeline'
import { createTempId } from './types'
import type { LocalPrettyModule } from './types'

type Props = {
  module: LocalPrettyModule
  jobId: string
  readOnly: boolean
  fieldErrors?: Record<string, string>
  onChange: (module: LocalPrettyModule) => void
}

export function TimelineModuleEditor({
  module,
  jobId,
  readOnly,
  fieldErrors = {},
  onChange,
}: Props) {
  const { data: timePeriods = [], isLoading } = useQuery(
    jobTimePeriodsQuery({ jobId }),
  )

  const handleImport = () => {
    const items = mapProgramPeriodsToTimelineItems(
      module.id,
      timePeriods,
      () => createTempId('timeline-item'),
    )
    onChange({ ...module, timeline_items: items })
  }

  return (
    <Box>
      <Flex direction="column" gap="3">
        <Heading size="4" mb="1">
          Program timeline
        </Heading>

        <Text size="1" color="gray" as="div">
          Imports a snapshot of the job program schedule. Changes to the job
          program after import will not affect this offer.
        </Text>

        <Box>
          <Text size="2" weight="medium" mb="1" as="div">
            Title <Text color="red">*</Text>
          </Text>
          {fieldErrors.title && (
            <Text size="1" color="red" mb="1" as="div">
              {fieldErrors.title}
            </Text>
          )}
          <TextField.Root
            value={module.title}
            disabled={readOnly}
            onChange={(e) => onChange({ ...module, title: e.target.value })}
            placeholder="Program timeline"
          />
        </Box>

        {!readOnly && (
          <Box>
            <Button
              size="2"
              variant="soft"
              disabled={isLoading}
              onClick={handleImport}
            >
              <Download width={16} height={16} />
              {module.timeline_items.length > 0
                ? 'Re-import from program'
                : 'Import from program'}
            </Button>
          </Box>
        )}

        {fieldErrors.timeline_items && (
          <Text size="1" color="red" as="div">
            {fieldErrors.timeline_items}
          </Text>
        )}

        {module.timeline_items.length > 0 ? (
          <TimelineBlock items={module.timeline_items} />
        ) : (
          <Text size="2" color="gray">
            No timeline imported yet.
            {!readOnly && ' Click import to copy the current program schedule.'}
          </Text>
        )}
      </Flex>
    </Box>
  )
}
