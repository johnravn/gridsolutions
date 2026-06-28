import { Box, Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { WarningTriangle } from 'iconoir-react'
import type { OverlapConflict } from '../api/overlapChecks'

function formatPeriod(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  return `${format(s, 'd. MMM HH:mm', { locale: nb })} – ${format(e, 'HH:mm', { locale: nb })}`
}

export function ForceBookingDialog({
  open,
  onOpenChange,
  resourceLabel,
  conflicts,
  warningLines,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceLabel: string
  conflicts?: Array<OverlapConflict>
  warningLines?: Array<string>
  onConfirm: () => void
  loading?: boolean
}) {
  const lines = warningLines ?? []
  const conflictRows = conflicts ?? []

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Flex align="center" gap="2" mb="2">
          <WarningTriangle width={20} height={20} color="var(--amber-11)" />
          <Dialog.Title mb="0">Scheduling conflict</Dialog.Title>
        </Flex>

        <Text size="2" color="gray" as="p">
          <Text weight="medium" color="amber">
            {resourceLabel}
          </Text>{' '}
          is already booked in an overlapping period. You can force this booking
          if the overlap is intentional. Forced overlaps appear on the
          dashboard.
        </Text>

        <Flex direction="column" gap="2" mt="3">
          {lines.map((line, index) => (
            <Box
              key={`${line}-${index}`}
              p="2"
              style={{
                borderRadius: 8,
                backgroundColor: 'var(--amber-a2)',
                border: '1px solid var(--amber-a5)',
              }}
            >
              <Text size="2" as="div">
                {line}
              </Text>
            </Box>
          ))}
          {conflictRows.map((conflict, index) => (
            <Box
              key={`${conflict.startAt}-${conflict.endAt}-${index}`}
              p="2"
              style={{
                borderRadius: 8,
                backgroundColor: 'var(--amber-a2)',
                border: '1px solid var(--amber-a5)',
              }}
            >
              <Text size="2" weight="medium" as="div">
                {conflict.jobTitle ?? 'Personal / other booking'}
              </Text>
              <Text size="1" color="gray" as="div">
                {formatPeriod(conflict.startAt, conflict.endAt)}
              </Text>
            </Box>
          ))}
        </Flex>

        <Flex justify="end" gap="2" mt="4">
          <Dialog.Close>
            <Button variant="soft" disabled={loading}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button color="amber" onClick={onConfirm} disabled={loading}>
            {loading ? 'Forcing…' : 'Force booking anyway'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
