import { Box, Table, Text } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { recurringJobBookingSummaryQuery } from '../../../api/recurringJobQueries'

type Props = {
  recurringJobId: string
  onSelectJob: (jobId: string) => void
}

export default function RecurringBookingsTab({
  recurringJobId,
  onSelectJob,
}: Props) {
  const { data: summaries = [], isLoading } = useQuery({
    ...recurringJobBookingSummaryQuery({ recurringJobId }),
  })

  if (isLoading) {
    return (
      <Text size="2" color="gray">
        Loading bookings…
      </Text>
    )
  }

  if (summaries.length === 0) {
    return (
      <Text size="2" color="gray">
        No jobs in this recurring job yet.
      </Text>
    )
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table.Root size="2" variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Job</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Crew</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Equipment</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Transport</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {summaries.map((row) => (
            <Table.Row
              key={row.job_id}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectJob(row.job_id)}
            >
              <Table.Cell>
                <Text weight="medium">{row.job_title}</Text>
                {row.jobnr != null && (
                  <Text size="1" color="gray">
                    {' '}
                    #{row.jobnr}
                  </Text>
                )}
              </Table.Cell>
              <Table.Cell>{row.crew_count}</Table.Cell>
              <Table.Cell>{row.equipment_count}</Table.Cell>
              <Table.Cell>{row.transport_count}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}
