import { Avatar, Badge, Box, Flex, Table, Text } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { getInitials, makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { recurringJobCrewSummaryQuery } from '../../../api/recurringJobQueries'

type Props = {
  recurringJobId: string
  onSelectJob: (jobId: string) => void
}

export default function RecurringCrewTab({
  recurringJobId,
  onSelectJob,
}: Props) {
  const { data: crew = [], isLoading } = useQuery({
    ...recurringJobCrewSummaryQuery({ recurringJobId }),
  })

  if (isLoading) {
    return (
      <Text size="2" color="gray">
        Loading crew…
      </Text>
    )
  }

  if (crew.length === 0) {
    return (
      <Text size="2" color="gray">
        No crew bookings across jobs in this recurring job yet.
      </Text>
    )
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table.Root size="2" variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Person</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Bookings</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {crew.map((entry) => {
            const avatarUrl = entry.avatar_url
              ? supabase.storage.from('avatars').getPublicUrl(entry.avatar_url)
                  .data.publicUrl
              : null
            const initials = getInitials(
              entry.display_name ?? entry.email ?? '',
            )
            return (
              <Table.Row key={entry.user_id}>
                <Table.Cell>
                  <Flex gap="2" align="center">
                    <Avatar
                      size="2"
                      src={avatarUrl ?? undefined}
                      fallback={initials}
                      radius="full"
                    />
                    <Box>
                      <Text size="2" weight="medium">
                        {entry.display_name || entry.email}
                      </Text>
                      <Text size="1" color="gray">
                        {entry.bookings.length} booking
                        {entry.bookings.length !== 1 ? 's' : ''}
                      </Text>
                    </Box>
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Flex direction="column" gap="2">
                    {entry.bookings.map((b, idx) => (
                      <Flex
                        key={`${b.job_id}-${idx}`}
                        gap="2"
                        align="center"
                        wrap="wrap"
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectJob(b.job_id)}
                      >
                        <Text size="2" style={{ textDecoration: 'underline' }}>
                          {b.job_title}
                          {b.jobnr != null ? ` (#${b.jobnr})` : ''}
                        </Text>
                        {b.role_title && (
                          <Text size="1" color="gray">
                            {b.role_title}
                          </Text>
                        )}
                        {b.start_at && (
                          <Text size="1" color="gray">
                            {format(new Date(b.start_at), 'd. MMM', {
                              locale: nb,
                            })}
                          </Text>
                        )}
                        <Badge size="1" variant="soft">
                          {makeWordPresentable(b.status)}
                        </Badge>
                      </Flex>
                    ))}
                  </Flex>
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}
