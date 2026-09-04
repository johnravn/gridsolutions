import { Button, Card, Flex, Text } from '@radix-ui/themes'

export function ReportError({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <Card size="3">
      <Flex direction="column" gap="2" align="start">
        <Text color="red">
          {message ?? 'Failed to load report data. Please try again.'}
        </Text>
        {onRetry ? (
          <Button size="1" variant="soft" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </Flex>
    </Card>
  )
}
