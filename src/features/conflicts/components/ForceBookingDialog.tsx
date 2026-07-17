import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { WarningTriangle } from 'iconoir-react'
import { ConflictCard } from './ConflictCard'
import type { OverlapConflict } from '../api/overlapChecks'

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
      <Dialog.Content maxWidth="560px">
        <Flex align="center" gap="2" mb="2">
          <WarningTriangle width={20} height={20} color="var(--amber-11)" />
          <Dialog.Title mb="0">Scheduling conflict</Dialog.Title>
        </Flex>

        <Dialog.Description size="2" color="gray">
          <Text as="span" weight="medium" color="amber">
            {resourceLabel}
          </Text>{' '}
          is already booked in an overlapping period. You can force this booking
          if the overlap is intentional. Forced overlaps appear on the
          dashboard.
        </Dialog.Description>

        <Flex direction="column" gap="2" mt="3">
          {lines.map((line, index) => (
            <Flex
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
            </Flex>
          ))}
          {conflictRows.map((conflict, index) => (
            <ConflictCard
              key={`${conflict.startAt}-${conflict.endAt}-${conflict.itemName ?? ''}-${index}`}
              conflict={conflict}
            />
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
