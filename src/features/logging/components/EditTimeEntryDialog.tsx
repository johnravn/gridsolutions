import * as React from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { updateTimeEntry } from '../api/timeEntries'
import {
  formatHoursBetween,
  formatHoursInput,
  hoursToRange,
  isValidLoggedHours,
  looksLikeHoursOnlyEntry,
  parseHoursInput,
  rangeToHours,
} from '../lib/timeEntryHours'
import TimeEntryWhenFields from './TimeEntryWhenFields'
import type { TimeEntryWithProfile } from '../api/timeEntries'
import type { TimeInputMode } from '../lib/timeEntryHours'

const defaultValues = {
  title: '',
  note: '',
  startAt: '',
  endAt: '',
  timeMode: 'range' as TimeInputMode,
  hoursInput: '1',
}

function hasInvalidTimeRange(startAt: string, endAt: string) {
  if (!startAt || !endAt) return false
  return new Date(endAt).getTime() <= new Date(startAt).getTime()
}

const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    note: z.string(),
    startAt: z.string().min(1, 'Start time is required'),
    endAt: z.string().min(1, 'End time is required'),
    timeMode: z.enum(['range', 'hours']),
    hoursInput: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.timeMode === 'hours') {
      if (!isValidLoggedHours(parseHoursInput(v.hoursInput))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter hours greater than 0, up to 24',
          path: ['hoursInput'],
        })
      }
      return
    }
    if (hasInvalidTimeRange(v.startAt, v.endAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endAt'],
      })
    }
  })

export default function EditTimeEntryDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
  disabled = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: TimeEntryWithProfile | null
  onSaved?: () => void
  disabled?: boolean
}) {
  const { success, error } = useToast()

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!open || !entry) return
    const hours = rangeToHours(entry.start_at, entry.end_at)
    form.reset(
      {
        title: entry.title ?? '',
        note: entry.note ?? '',
        startAt: entry.start_at ?? '',
        endAt: entry.end_at ?? '',
        timeMode: looksLikeHoursOnlyEntry(entry.start_at, entry.end_at)
          ? 'hours'
          : 'range',
        hoursInput: formatHoursInput(hours > 0 ? hours : 1),
      },
      { keepDefaultValues: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, entry?.id])

  const updateMutation = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!entry) throw new Error('Missing entry')

      let startAt = value.startAt
      let endAt = value.endAt
      if (value.timeMode === 'hours') {
        const hours = parseHoursInput(value.hoursInput)
        if (!isValidLoggedHours(hours)) {
          throw new Error('Enter hours greater than 0, up to 24')
        }
        const range = hoursToRange(value.startAt, hours)
        startAt = range.startAt
        endAt = range.endAt
      }

      await updateTimeEntry({
        id: entry.id,
        changes: {
          title: value.title.trim(),
          note: value.note.trim() || null,
          start_at: startAt,
          end_at: endAt,
        },
      })
    },
    onSuccess: () => {
      success('Saved', 'Time entry updated')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (e: any) => {
      error('Failed to save', e?.message || 'Please try again.')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="3" style={{ maxWidth: 520 }}>
        <Dialog.Title>Edit time entry</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Update the details for this entry.
        </Dialog.Description>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3">
              <form.AppField name="title">
                {(field) => (
                  <field.TextField
                    label="Title"
                    placeholder="Time entry title"
                    disabled={disabled}
                  />
                )}
              </form.AppField>

              <form.Subscribe
                selector={(state): [TimeInputMode, string, string, string] => [
                  state.values.timeMode,
                  state.values.startAt,
                  state.values.endAt,
                  state.values.hoursInput,
                ]}
              >
                {([timeMode, startAt, endAt, hoursInput]) => (
                  <TimeEntryWhenFields
                    mode={timeMode}
                    onModeChange={(mode) =>
                      form.setFieldValue('timeMode', mode)
                    }
                    startAt={startAt}
                    endAt={endAt}
                    onRangeChange={({ startAt: nextStart, endAt: nextEnd }) => {
                      form.setFieldValue('startAt', nextStart)
                      form.setFieldValue('endAt', nextEnd)
                    }}
                    hoursInput={hoursInput}
                    onHoursInputChange={(value) =>
                      form.setFieldValue('hoursInput', value)
                    }
                    rangeInvalid={hasInvalidTimeRange(startAt, endAt)}
                    disabled={disabled}
                  />
                )}
              </form.Subscribe>

              <form.AppField name="note">
                {(field) => (
                  <field.TextArea
                    label="Note"
                    rows={2}
                    placeholder="Optional notes"
                    style={{ minHeight: 60, width: '100%', display: 'block' }}
                    disabled={disabled}
                  />
                )}
              </form.AppField>

              <form.Subscribe
                selector={(state) => [
                  state.values.startAt,
                  state.values.endAt,
                  state.values.timeMode,
                  state.values.hoursInput,
                ]}
              >
                {([startAt, endAt, timeMode, hoursInput]) => {
                  const hoursInvalid =
                    timeMode === 'hours' &&
                    !isValidLoggedHours(parseHoursInput(hoursInput))
                  return (
                    <Flex justify="between" align="center" mt="2">
                      <Text size="3" weight="medium">
                        {formatHoursBetween(startAt, endAt)}
                      </Text>
                      <Flex gap="2">
                        <Dialog.Close>
                          <Button
                            type="button"
                            variant="soft"
                            disabled={updateMutation.isPending}
                          >
                            Cancel
                          </Button>
                        </Dialog.Close>
                        <form.SubmitButton
                          label="Save"
                          pendingLabel="Saving…"
                          disabled={disabled || hoursInvalid}
                        />
                      </Flex>
                    </Flex>
                  )
                }}
              </form.Subscribe>
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
