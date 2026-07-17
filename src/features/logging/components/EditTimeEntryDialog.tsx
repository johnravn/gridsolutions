import * as React from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { DateTimeRangePicker } from '@shared/ui/components/pickers'
import { updateTimeEntry } from '../api/timeEntries'
import type { TimeEntryWithProfile } from '../api/timeEntries'

const defaultValues = {
  title: '',
  jobNumber: '',
  note: '',
  startAt: '',
  endAt: '',
}

function hasInvalidTimeRange(startAt: string, endAt: string) {
  if (!startAt || !endAt) return false
  return new Date(endAt).getTime() <= new Date(startAt).getTime()
}

const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    jobNumber: z.string(),
    note: z.string(),
    startAt: z.string().min(1, 'Start time is required'),
    endAt: z.string().min(1, 'End time is required'),
  })
  .refine((v) => !hasInvalidTimeRange(v.startAt, v.endAt), {
    message: 'End time must be after start time',
    path: ['endAt'],
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
    form.reset(
      {
        title: entry.title ?? '',
        jobNumber: entry.job_number ?? '',
        note: entry.note ?? '',
        startAt: entry.start_at ?? '',
        endAt: entry.end_at ?? '',
      },
      { keepDefaultValues: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, entry?.id])

  const updateMutation = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!entry) throw new Error('Missing entry')

      await updateTimeEntry({
        id: entry.id,
        changes: {
          title: value.title.trim(),
          job_number: value.jobNumber.trim() || null,
          note: value.note.trim() || null,
          start_at: value.startAt,
          end_at: value.endAt,
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

              <form.AppField name="jobNumber">
                {(field) => (
                  <field.TextField
                    label="Job number"
                    placeholder="Optional"
                    disabled={disabled}
                  />
                )}
              </form.AppField>

              <form.AppField name="startAt">
                {(startField) => (
                  <form.AppField name="endAt">
                    {(endField) => (
                      <label>
                        <Text as="div" size="2" mb="1" weight="medium">
                          Time period
                        </Text>
                        <DateTimeRangePicker
                          startAt={startField.state.value}
                          endAt={endField.state.value}
                          onChange={({ startAt, endAt }) => {
                            startField.handleChange(startAt)
                            endField.handleChange(endAt)
                          }}
                          invalid={hasInvalidTimeRange(
                            startField.state.value,
                            endField.state.value,
                          )}
                          disabled={disabled}
                          locale="nb"
                        />
                      </label>
                    )}
                  </form.AppField>
                )}
              </form.AppField>

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
                selector={(state) => [state.values.startAt, state.values.endAt]}
              >
                {([startAt, endAt]) => (
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
                        disabled={disabled}
                      />
                    </Flex>
                  </Flex>
                )}
              </form.Subscribe>
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function formatHoursBetween(startAt: string, endAt: string) {
  if (!startAt || !endAt) return '--'
  const start = new Date(startAt)
  const end = new Date(endAt)
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const hours = durationMs / (1000 * 60 * 60)
  return `${hours.toFixed(2)} hours`
}
