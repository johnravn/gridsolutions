import * as React from 'react'
import {
  Button,
  Dialog,
  Flex,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useMutation } from '@tanstack/react-query'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { updateTimeEntry } from '../api/timeEntries'
import type { TimeEntryWithProfile } from '../api/timeEntries'

type FormState = {
  title: string
  jobNumber: string
  note: string
  startAt: string
  endAt: string
}

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
  const [form, setForm] = React.useState<FormState>({
    title: '',
    jobNumber: '',
    note: '',
    startAt: '',
    endAt: '',
  })
  const hasInvalidTimeRange = React.useMemo(() => {
    if (!form.startAt || !form.endAt) return false
    return new Date(form.endAt).getTime() < new Date(form.startAt).getTime()
  }, [form.endAt, form.startAt])

  const set = <TKey extends keyof FormState>(
    key: TKey,
    value: FormState[TKey],
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  React.useEffect(() => {
    if (!open || !entry) return
    setForm({
      title: entry.title ?? '',
      jobNumber: entry.job_number ?? '',
      note: entry.note ?? '',
      startAt: entry.start_at ?? '',
      endAt: entry.end_at ?? '',
    })
  }, [open, entry?.id])

  const pickedHours = React.useMemo(
    () => formatHoursBetween(form.startAt, form.endAt),
    [form.startAt, form.endAt],
  )

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error('Missing entry')
      if (!form.title.trim()) throw new Error('Title is required')
      if (!form.startAt || !form.endAt) {
        throw new Error('Start and end time are required')
      }
      if (hasInvalidTimeRange) {
        throw new Error('End time must be after start time')
      }

      await updateTimeEntry({
        id: entry.id,
        changes: {
          title: form.title.trim(),
          job_number: form.jobNumber.trim() || null,
          note: form.note.trim() || null,
          start_at: form.startAt,
          end_at: form.endAt,
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

        <Flex direction="column" gap="3">
          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Title
            </Text>
            <TextField.Root
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Time entry title"
              disabled={disabled}
            />
          </label>

          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Job number
            </Text>
            <TextField.Root
              value={form.jobNumber}
              onChange={(e) => set('jobNumber', e.target.value)}
              placeholder="Optional"
              disabled={disabled}
            />
          </label>

          <DateTimePicker
            label="Start"
            value={form.startAt}
            onChange={(value) => set('startAt', value)}
            disabled={disabled}
          />
          <DateTimePicker
            label="End"
            value={form.endAt}
            onChange={(value) => set('endAt', value)}
            disabled={disabled}
            invalid={hasInvalidTimeRange}
          />

          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Note
            </Text>
            <TextArea
              rows={2}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Optional notes"
              style={{ minHeight: 60, width: '100%', display: 'block' }}
              disabled={disabled}
            />
          </label>

          <Flex justify="between" align="center" mt="2">
            <Text size="3" weight="medium">
              {pickedHours}
            </Text>
            <Flex gap="2">
              <Dialog.Close>
                <Button variant="soft" disabled={updateMutation.isPending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={
                  disabled ||
                  updateMutation.isPending ||
                  !form.title.trim() ||
                  hasInvalidTimeRange
                }
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </Flex>
          </Flex>
        </Flex>
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
