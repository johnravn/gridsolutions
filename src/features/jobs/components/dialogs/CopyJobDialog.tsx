import * as React from 'react'
import { Button, Dialog, Flex, Separator, Text } from '@radix-ui/themes'
import {
  DateTimeRangePicker,
  isInvalidTimeRange,
} from '@shared/ui/components/pickers'

function addYearsKeepingTime(iso: string, years: number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString()
}

export default function CopyJobDialog({
  open,
  onOpenChange,
  initialStartAt,
  initialEndAt,
  onConfirm,
  isCopying,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStartAt: string | null
  initialEndAt: string | null
  onConfirm: (payload: { startAt: string; endAt: string }) => void
  isCopying: boolean
}) {
  const [startAt, setStartAt] = React.useState('')
  const [endAt, setEndAt] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    if (initialStartAt) setStartAt(addYearsKeepingTime(initialStartAt, 1))
    else setStartAt('')
    if (initialEndAt) setEndAt(addYearsKeepingTime(initialEndAt, 1))
    else setEndAt('')
  }, [open, initialStartAt, initialEndAt])

  const hasInvalidTimeRange = isInvalidTimeRange(startAt, endAt)
  const canSubmit = Boolean(startAt && endAt && !hasInvalidTimeRange)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Copy job</Dialog.Title>
        <Dialog.Description>
          Choose the new start and end time for the copied job.
        </Dialog.Description>
        <Separator my="3" />

        <Flex direction="column" gap="3">
          <DateTimeRangePicker
            startAt={startAt}
            endAt={endAt}
            onChange={({ startAt: s, endAt: e }) => {
              setStartAt(s)
              setEndAt(e)
            }}
            invalid={hasInvalidTimeRange}
          />

          {hasInvalidTimeRange && (
            <Text size="2" color="red">
              End time must be after start time.
            </Text>
          )}
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Button
            variant="soft"
            onClick={() => onOpenChange(false)}
            disabled={isCopying}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({ startAt, endAt })}
            disabled={!canSubmit || isCopying}
          >
            {isCopying ? 'Copying…' : 'Copy job'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
