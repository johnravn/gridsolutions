import * as React from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Spinner,
  Text,
} from '@radix-ui/themes'
import {
  fetchResendSentEmailDetail,
  fetchResendSentEmails,
  formatMonitorDateTime,
  formatResendRecipients,
  resendEventBadgeColor,
} from '../api/monitorQueries'
import { MonitorVirtualList } from './MonitorVirtualList'
import type { ResendSentEmail } from '../api/monitorQueries'

const RESEND_LIST_MAX_HEIGHT = 420

function ResendEmailCard({
  email,
  onExpandChange,
  onContentSizeChange,
}: {
  email: ResendSentEmail
  onExpandChange: (emailId: string, expanded: boolean) => void
  onContentSizeChange: () => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const detailQuery = useQuery({
    queryKey: ['super', 'monitor', 'resend-email', email.id],
    queryFn: () => fetchResendSentEmailDetail(email.id),
    enabled: expanded,
  })

  React.useEffect(() => {
    if (!expanded) return
    onContentSizeChange()
  }, [
    expanded,
    detailQuery.isFetching,
    detailQuery.isSuccess,
    detailQuery.isError,
    detailQuery.dataUpdatedAt,
    onContentSizeChange,
  ])

  const toggle = () => {
    setExpanded((v) => {
      const next = !v
      onExpandChange(email.id, next)
      return next
    })
  }

  return (
    <Box
      p="3"
      style={{
        borderRadius: 'var(--radius-3)',
        background: 'var(--gray-a2)',
      }}
    >
      <Flex align="start" justify="between" gap="3" wrap="wrap">
        <Box style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Text size="2" weight="medium" as="div" truncate>
            {email.subject || '(no subject)'}
          </Text>
          <Text size="1" color="gray" as="div" mt="1">
            {formatMonitorDateTime(email.created_at)} ·{' '}
            {formatResendRecipients(email.to)}
          </Text>
          <Text size="1" color="gray" as="div" truncate>
            From: {email.from}
          </Text>
        </Box>
        <Flex align="center" gap="2">
          {email.last_event ? (
            <Badge
              color={resendEventBadgeColor(email.last_event)}
              variant="soft"
              size="1"
            >
              {email.last_event}
            </Badge>
          ) : null}
          <Button type="button" size="1" variant="ghost" onClick={toggle}>
            {expanded ? 'Hide' : 'View'}
          </Button>
        </Flex>
      </Flex>
      {expanded ? (
        <Box mt="3">
          {detailQuery.isLoading ? (
            <Flex align="center" gap="2">
              <Spinner size="1" />
              <Text size="2" color="gray">
                Loading from Resend…
              </Text>
            </Flex>
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
                    as="div"
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
                    as="div"
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
        </Box>
      ) : null}
    </Box>
  )
}

export default function SuperResendEmailsSection() {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [sizeTick, setSizeTick] = React.useState(0)
  const onContentSizeChange = React.useCallback(() => {
    setSizeTick((n) => n + 1)
  }, [])
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
      fetchResendSentEmails(pageParam ? { after: pageParam } : undefined),
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

  const measureKey = `${expandedId ?? ''}:${emails.length}:${sizeTick}`

  return (
    <Card size="3" style={{ flexShrink: 0 }}>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
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
        <Text size="2" color="gray">
          Live list from the Resend API — every email your team has sent through
          Resend, not just rows tracked in Grid.
        </Text>

        {isLoading ? (
          <Flex align="center" gap="2">
            <Spinner size="2" />
            <Text size="2" color="gray">
              Loading emails from Resend…
            </Text>
          </Flex>
        ) : isError ? (
          <Flex direction="column" gap="2">
            <Callout.Root color="red" variant="soft">
              <Callout.Text>
                {error instanceof Error
                  ? error.message
                  : 'Failed to load emails'}
              </Callout.Text>
            </Callout.Root>
            <Text size="1" color="gray">
              Requires the list-resend-emails edge function and RESEND_API_KEY
              on the Supabase project. See docs/EMAIL.md.
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
            No sent emails returned from Resend yet. Sends from Grid appear here
            after Resend accepts them (not the same as the pending notification
            queue above).
          </Text>
        ) : (
          <MonitorVirtualList
            items={emails}
            getItemKey={(email) => email.id}
            estimateSize={88}
            maxHeight={RESEND_LIST_MAX_HEIGHT}
            measureKey={measureKey}
            hasNextPage={Boolean(hasNextPage)}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => {
              void fetchNextPage()
            }}
            renderItem={(email) => (
              <ResendEmailCard
                email={email}
                onExpandChange={(id, expanded) => {
                  setExpandedId(expanded ? id : null)
                }}
                onContentSizeChange={onContentSizeChange}
              />
            )}
          />
        )}
      </Flex>
    </Card>
  )
}
