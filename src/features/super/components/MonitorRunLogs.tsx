import * as React from 'react'
import { Badge, Box, Button, Flex, Text } from '@radix-ui/themes'
import {
  formatRunDetailsJson,
  getContaErrorLogForDetails,
} from '../api/monitorQueries'
import type { ContaErrorLogEntry } from '../api/monitorQueries'

function companyLabel(entry: ContaErrorLogEntry): string {
  return entry.companyName?.trim() || entry.companyId
}

export function ContaErrorLogPanel({
  details,
  defaultOpen = false,
}: {
  details: Record<string, unknown> | null | undefined
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const entries = React.useMemo(
    () => getContaErrorLogForDetails(details),
    [details],
  )

  if (entries.length === 0) return null

  const total = entries.reduce((n, entry) => n + entry.count, 0)

  return (
    <Box mt="1">
      <Flex align="center" gap="2" wrap="wrap">
        <Button
          type="button"
          size="1"
          variant="soft"
          color="red"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Hide error log' : 'Show error log'}
        </Button>
        <Badge color="red" variant="soft" size="1">
          {total} {total === 1 ? 'error' : 'errors'} · {entries.length}{' '}
          {entries.length === 1 ? 'message' : 'messages'}
        </Badge>
      </Flex>
      {open ? (
        <Box
          mt="2"
          p="2"
          style={{
            borderRadius: 'var(--radius-2)',
            background: 'var(--red-a2)',
            border: '1px solid var(--red-a5)',
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          <Flex direction="column" gap="2">
            {entries.map((entry) => (
              <Box key={`${entry.companyId}:${entry.message}`}>
                <Flex align="center" gap="2" wrap="wrap" mb="1">
                  <Text size="1" weight="bold">
                    {companyLabel(entry)}
                  </Text>
                  <Badge color="red" variant="soft" size="1">
                    ×{entry.count}
                  </Badge>
                </Flex>
                <Text
                  size="1"
                  color="red"
                  as="div"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {entry.message}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>
      ) : null}
    </Box>
  )
}

export function RunDetailsLogPanel({
  details,
  jobKey,
  includeContaErrors = true,
}: {
  details: Record<string, unknown> | null | undefined
  jobKey?: string
  /** When false, only the raw JSON payload is shown (Conta errors rendered elsewhere). */
  includeContaErrors?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const isConta =
    jobKey === 'conta_customer_sync' || jobKey === 'conta_invoice_paid_sync'
  const json = formatRunDetailsJson(details)
  const hasDetails = Boolean(details)

  if (!hasDetails) return null

  return (
    <Box mt="1">
      <Flex align="center" gap="2" wrap="wrap">
        <Button
          type="button"
          size="1"
          variant="soft"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Hide logs' : 'Show logs'}
        </Button>
      </Flex>
      {open ? (
        <Flex direction="column" gap="2" mt="2">
          {isConta && includeContaErrors ? (
            <ContaErrorLogPanel details={details} defaultOpen />
          ) : null}
          <Box
            p="2"
            style={{
              borderRadius: 'var(--radius-2)',
              background: 'var(--gray-a2)',
              border: '1px solid var(--gray-a5)',
              maxHeight: 280,
              overflow: 'auto',
            }}
          >
            <Text size="1" color="gray" as="div" mb="1">
              Stored run details
            </Text>
            <Box
              asChild
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'var(--code-font-family, ui-monospace, monospace)',
                fontSize: 'var(--font-size-1)',
                lineHeight: 'var(--line-height-1)',
                color: 'var(--gray-12)',
              }}
            >
              <pre>{json}</pre>
            </Box>
          </Box>
        </Flex>
      ) : null}
    </Box>
  )
}
