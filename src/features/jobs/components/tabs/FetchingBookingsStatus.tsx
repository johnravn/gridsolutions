import { Flex, Spinner, Text } from '@radix-ui/themes'

export function FetchingBookingsStatus({
  label = 'Fetching bookings…',
}: {
  label?: string
}) {
  return (
    <Flex
      align="center"
      justify="center"
      gap="2"
      py="6"
      role="status"
      aria-live="polite"
    >
      <Spinner size="3" />
      <Text size="2" color="gray">
        {label}
      </Text>
    </Flex>
  )
}
