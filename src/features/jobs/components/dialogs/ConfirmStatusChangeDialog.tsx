// src/features/jobs/components/dialogs/ConfirmStatusChangeDialog.tsx
import * as React from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import type { BookingStatus } from '../../types'

export default function ConfirmStatusChangeDialog({
  open,
  onOpenChange,
  currentStatus,
  newStatus,
  crewName,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentStatus: BookingStatus
  newStatus: BookingStatus
  crewName: string
  onConfirm: () => void
}) {
  const statusLabels: Record<BookingStatus, string> = {
    planned: 'Planned',
    confirmed: 'Confirmed',
    canceled: 'Canceled',
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 400 }}>
        <Dialog.Title>Confirm Status Change</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to change {crewName}'s status from{' '}
          <strong>{statusLabels[currentStatus]}</strong> to{' '}
          <strong>{statusLabels[newStatus]}</strong>?
        </Dialog.Description>

        <Flex mt="4" gap="2" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            color={newStatus === 'canceled' ? 'red' : undefined}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Confirm
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
