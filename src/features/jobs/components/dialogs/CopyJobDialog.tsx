import * as React from 'react'
import { Button, Dialog, Flex, Separator, Text } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
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

const defaultValues = {
  startAt: '',
  endAt: '',
}

const schema = z
  .object({
    startAt: z.string().min(1, 'Start time is required'),
    endAt: z.string().min(1, 'End time is required'),
  })
  .refine((v) => !isInvalidTimeRange(v.startAt, v.endAt), {
    message: 'End time must be after start time.',
    path: ['endAt'],
  })

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
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: ({ value }) => {
      onConfirm({ startAt: value.startAt, endAt: value.endAt })
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset(
      {
        startAt: initialStartAt ? addYearsKeepingTime(initialStartAt, 1) : '',
        endAt: initialEndAt ? addYearsKeepingTime(initialEndAt, 1) : '',
      },
      { keepDefaultValues: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, initialStartAt, initialEndAt])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Copy job</Dialog.Title>
        <Dialog.Description>
          Choose the new start and end time for the copied job.
        </Dialog.Description>
        <Separator my="3" />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <form.Subscribe
              selector={(state) => [state.values.startAt, state.values.endAt]}
            >
              {([startAt, endAt]) => {
                const hasInvalidTimeRange = isInvalidTimeRange(startAt, endAt)
                return (
                  <Flex direction="column" gap="3">
                    <DateTimeRangePicker
                      startAt={startAt}
                      endAt={endAt}
                      onChange={({ startAt: s, endAt: e }) => {
                        form.setFieldValue('startAt', s)
                        form.setFieldValue('endAt', e)
                      }}
                      invalid={hasInvalidTimeRange}
                    />

                    {hasInvalidTimeRange && (
                      <Text size="2" color="red">
                        End time must be after start time.
                      </Text>
                    )}
                  </Flex>
                )
              }}
            </form.Subscribe>

            <Flex gap="3" mt="4" justify="end">
              <Button
                type="button"
                variant="soft"
                onClick={() => onOpenChange(false)}
                disabled={isCopying}
              >
                Cancel
              </Button>
              <form.SubmitButton
                label="Copy job"
                pendingLabel="Copying…"
                disabled={isCopying}
              />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
