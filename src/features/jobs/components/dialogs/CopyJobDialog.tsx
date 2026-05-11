import * as React from 'react'
import { Button, Dialog, Flex, Separator, Text } from '@radix-ui/themes'
import DateTimePicker from '@shared/ui/components/DateTimePicker'

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

  const getDateMs = (value: string) => {
    const ms = new Date(value).getTime()
    return Number.isNaN(ms) ? null : ms
  }
  const hasInvalidTimeRange = (() => {
    const startMs = getDateMs(startAt)
    const endMs = getDateMs(endAt)
    if (startMs === null || endMs === null) return false
    return endMs < startMs
  })()

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
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium" color="gray">
              Start
            </Text>
            <DateTimePicker value={startAt} onChange={(v) => setStartAt(v)} />
          </Flex>

          <Flex direction="column" gap="1">
            <Text size="2" weight="medium" color="gray">
              End
            </Text>
            <DateTimePicker value={endAt} onChange={(v) => setEndAt(v)} />
          </Flex>

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

