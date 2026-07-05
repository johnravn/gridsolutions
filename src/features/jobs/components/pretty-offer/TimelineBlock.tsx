import { Box, Flex, Heading, Table, Text } from '@radix-ui/themes'
import {
  formatProgramDateTime,
  formatProgramDuration,
  groupProgramPeriods,
} from '../../utils/programTimeline'
import type { PrettyOfferModuleBlockItem } from '../../types'

export type TimelineBlockItem = PrettyOfferModuleBlockItem & {
  start_at?: string | null
  end_at?: string | null
}

type Props = {
  items: Array<TimelineBlockItem>
}

export function TimelineBlock({ items }: Props) {
  const periods = items
    .filter((item) => item.start_at && item.end_at)
    .map((item) => ({
      id: item.id,
      job_id: null,
      company_id: '',
      title: item.label,
      start_at: item.start_at!,
      end_at: item.end_at!,
      category: 'program' as const,
      program_group: item.summary,
    }))

  const grouped = groupProgramPeriods(periods)

  if (grouped.length === 0) {
    return (
      <Text size="2" color="gray" mb="3" as="div">
        No program timeline entries.
      </Text>
    )
  }

  return (
    <Box mb="4">
      {grouped.map(([groupName, groupPeriods]) => (
        <Box key={groupName ?? '_ungrouped'} mb="4">
          {groupName && (
            <Flex
              align="center"
              gap="2"
              mb="2"
              py="2"
              className="pretty-deck-timeline__group-header"
            >
              <Heading size="3">{groupName}</Heading>
            </Flex>
          )}
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Start</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>End</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Duration</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {groupPeriods.map((period) => (
                <Table.Row key={period.id}>
                  <Table.Cell>
                    <Text weight="medium">{period.title || '(untitled)'}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">
                      {formatProgramDateTime(period.start_at)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatProgramDateTime(period.end_at)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {formatProgramDuration(period.start_at, period.end_at)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      ))}
    </Box>
  )
}
