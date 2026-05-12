import { useMutation } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { sendSuperSampleEmail } from '../api/superEmailSamples'
import type { SuperEmailSampleKind } from '../api/superEmailSamples'

const SAMPLE_ROWS: Array<{
  kind: SuperEmailSampleKind
  title: string
  detail: string
}> = [
  {
    kind: 'matter_test',
    title: 'Matter test email',
    detail:
      'Edge function send-test-email — Grid wordmark inlined; sender name Grid.',
  },
  {
    kind: 'notification',
    title: 'Notification email',
    detail:
      'Creates a notifications row and queues send-notification-email (pg_net when vault is configured).',
  },
  {
    kind: 'welcome',
    title: 'Welcome / company invite',
    detail:
      'Pending invite flow — send-welcome-email (insert trigger or explicit send if invite already exists).',
  },
  {
    kind: 'offer',
    title: 'Job offer email',
    detail:
      'send-offer-email — requires at least one locked offer in a company you belong to.',
  },
  {
    kind: 'crew_position_invite',
    title: 'Crew position invite',
    detail:
      'send-crew-position-invite-email — uses a planned email-only crew slot if you have one; otherwise creates a small “[Super sample] Crew invite fixture” job with a placeholder crew row (your profile email is applied for this send if needed).',
  },
]

export default function SuperEmailTab() {
  const { success, error: toastError } = useToast()

  const mutation = useMutation({
    mutationFn: sendSuperSampleEmail,
    onSuccess: (_void, kind) => {
      success(
        'Email queued',
        SAMPLE_ROWS.find((r) => r.kind === kind)?.title ?? 'Sample sent',
      )
    },
    onError: (e: unknown) => {
      toastError(
        'Could not send sample',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  return (
    <Card size="3">
      <Heading size="5" mb="2">
        Email samples
      </Heading>
      <Text size="2" color="gray" mb="4">
        Each button sends that transactional template to your profile email via
        Resend (same Edge Functions as production). Fixtures must exist where
        noted — for example a locked offer. Crew invite creates a fixture job if
        none exists (crew invite temporarily points at your address for the
        sample).
      </Text>
      <Separator size="4" mb="4" />
      <Flex direction="column" gap="4">
        {SAMPLE_ROWS.map((row) => (
          <Box key={row.kind}>
            <Flex align="start" gap="4" justify="between" wrap="wrap">
              <Flex
                direction="column"
                gap="2"
                style={{ flex: '1 1 280px', minWidth: 0 }}
              >
                <Text weight="bold" size="3" as="div">
                  {row.title}
                </Text>
                <Text size="2" color="gray" as="div">
                  {row.detail}
                </Text>
              </Flex>
              <Button
                type="button"
                variant="soft"
                style={{ flexShrink: 0, alignSelf: 'flex-start' }}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(row.kind)}
              >
                {mutation.isPending && mutation.variables === row.kind
                  ? 'Sending…'
                  : 'Send to me'}
              </Button>
            </Flex>
          </Box>
        ))}
      </Flex>
    </Card>
  )
}
