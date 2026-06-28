import * as React from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Table,
  Text,
} from '@radix-ui/themes'
import {
  fetchResendSentEmailDetail,
  fetchResendSentEmails,
  formatMonitorDateTime,
  formatResendRecipients,
  resendEventBadgeColor,
} from '../api/monitorQueries'
import type { ResendSentEmail } from '../api/monitorQueries'

function ResendEmailRow({ email }: { email: ResendSentEmail }) {
  const [expanded, setExpanded] = React.useState(false)
  const detailQuery = useQuery({
    queryKey: ['super', 'monitor', 'resend-email', email.id],
    queryFn: () => fetchResendSentEmailDetail(email.id),
    enabled: expanded,
  })

  return (
    <>
      <Table.Row>
        <Table.Cell>{formatMonitorDateTime(email.created_at)}</Table.Cell>
        <Table.Cell style={{ maxWidth: 220 }}>
          <Text size="2" weight="medium" as="div" truncate>
            {email.subject || '(no subject)'}
          </Text>
        </Table.Cell>
        <Table.Cell>{formatResendRecipients(email.to)}</Table.Cell>
        <Table.Cell style={{ maxWidth: 180 }}>
          <Text size="1" truncate>
            {email.from}
          </Text>
        </Table.Cell>
        <Table.Cell>
          {email.last_event ? (
            <Badge
              color={resendEventBadgeColor(email.last_event)}
              variant="soft"
              size="1"
            >
              {email.last_event}
            </Badge>
          ) : (
            '—'
          )}
        </Table.Cell>
        <Table.Cell>
          <Button
            type="button"
            size="1"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide' : 'View'}
          </Button>
        </Table.Cell>
      </Table.Row>
      {expanded ? (
        <Table.Row>
          <Table.Cell colSpan={6}>
            {detailQuery.isLoading ? (
              <Text size="2" color="gray">
                Loading from Resend…
              </Text>
            ) : detailQuery.isError ? (
              <Text size="2" color="red">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : 'Failed to load email'}
              </Text>
            ) : detailQuery.data ? (
              <Flex direction="column" gap="2">
                <Text size="1" color="gray" as="div">
                  Resend ID: {detailQuery.data.id}
                  {detailQuery.data.message_id
                    ? ` · Message-ID: ${detailQuery.data.message_id}`
                    : ''}
                </Text>
                {detailQuery.data.text ? (
                  <Box>
                    <Text size="1" weight="medium" mb="1" as="div">
                      Plain text
                    </Text>
                    <Text
                      size="1"
                      as="pre"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                        fontFamily: 'var(--font-mono, monospace)',
                        maxHeight: 200,
                        overflow: 'auto',
                      }}
                    >
                      {detailQuery.data.text}
                    </Text>
                  </Box>
                ) : null}
                {detailQuery.data.html ? (
                  <Box>
                    <Text size="1" weight="medium" mb="1" as="div">
                      HTML
                    </Text>
                    <Text
                      size="1"
                      as="pre"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                        fontFamily: 'var(--font-mono, monospace)',
                        maxHeight: 240,
                        overflow: 'auto',
                      }}
                    >
                      {detailQuery.data.html}
                    </Text>
                  </Box>
                ) : !detailQuery.data.text ? (
                  <Text size="2" color="gray">
                    No body content returned by Resend for this message.
                  </Text>
                ) : null}
              </Flex>
            ) : null}
          </Table.Cell>
        </Table.Row>
      ) : null}
    </>
  )
}

export default function SuperResendEmailsSection() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['super', 'monitor', 'resend-emails'],
    queryFn: ({ pageParam }) =>
      fetchResendSentEmails(
        pageParam ? { after: pageParam } : undefined,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.has_more || lastPage.data.length === 0) return undefined
      return lastPage.data[lastPage.data.length - 1]?.id
    },
  })

  const emails = React.useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data?.pages],
  )

  return (
    <Card size="3">
      <Flex align="center" justify="between" gap="3" wrap="wrap" mb="2">
        <Heading size="4">Resend sent emails</Heading>
        <Flex align="center" gap="2">
          {isFetching && !isFetchingNextPage ? (
            <Text size="1" color="gray">
              Refreshing…
            </Text>
          ) : null}
          <Button
            type="button"
            size="1"
            variant="soft"
            onClick={() => void refetch()}
          >
            Refresh
          </Button>
        </Flex>
      </Flex>
      <Text size="2" color="gray" mb="4">
        Live list from the Resend API — every email your team has sent through
        Resend, not just rows tracked in Grid.
      </Text>

      {isLoading ? (
        <Text size="2" color="gray">
          Loading emails from Resend…
        </Text>
      ) : isError ? (
        <Flex direction="column" gap="2">
          <Text size="2" color="red">
            {error instanceof Error ? error.message : 'Failed to load emails'}
          </Text>
          <Button
            type="button"
            size="2"
            variant="soft"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </Flex>
      ) : emails.length === 0 ? (
        <Text size="2" color="gray">
          No sent emails returned from Resend.
        </Text>
      ) : (
        <>
          <Box style={{ overflowX: 'auto' }}>
            <Table.Root variant="surface" size="1">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Sent</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Subject</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>To</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>From</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {emails.map((email) => (
                  <ResendEmailRow key={email.id} email={email} />
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
          {hasNextPage ? (
            <Flex justify="center" mt="3">
              <Button
                type="button"
                variant="soft"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </Flex>
          ) : null}
        </>
      )}
    </Card>
  )
}
