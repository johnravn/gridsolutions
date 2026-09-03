import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { DateTimeRangePicker } from '@shared/ui/components/pickers'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import { findCrewOverlaps } from '@features/conflicts/api/overlapChecks'
import {
  createPersonalCalendarEvent,
  deletePersonalCalendarEvent,
  updatePersonalCalendarEvent,
} from '../../api/personalCalendarEvents'

export type PersonalEventDraft = {
  id: string
  title: string
  start: string
  end: string
  userId: string
}

function defaultRange(): { startAt: string; endAt: string } {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start)
  end.setHours(end.getHours() + 4)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

export default function PersonalCalendarEventDialog({
  open,
  onOpenChange,
  userId,
  event,
  readOnly,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  event: PersonalEventDraft | null
  readOnly?: boolean
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const isEdit = Boolean(event?.id)
  const defaults = defaultRange()
  const [title, setTitle] = React.useState(event?.title ?? '')
  const [startAt, setStartAt] = React.useState(event?.start ?? defaults.startAt)
  const [endAt, setEndAt] = React.useState(event?.end ?? defaults.endAt)

  React.useEffect(() => {
    if (!open) return
    const next = defaultRange()
    setTitle(event?.title ?? '')
    setStartAt(event?.start ?? next.startAt)
    setEndAt(event?.end ?? next.endAt)
  }, [open, event])

  const invalidateCalendar = () => {
    qc.invalidateQueries({ queryKey: ['company', companyId, 'calendar'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Not signed in')
      const trimmed = title.trim()
      if (!trimmed) throw new Error('Title is required')
      if (!startAt || !endAt || endAt <= startAt) {
        throw new Error('Choose a valid start and end')
      }

      const overlaps = await findCrewOverlaps({
        userIds: [userId],
        startAt,
        endAt,
        excludePersonalEventId: event?.id,
        skipForcedCrew: true,
      })
      const conflicts = overlaps.get(userId) ?? []
      if (conflicts.length > 0) {
        const first = conflicts[0]
        throw new Error(
          first.jobTitle
            ? `This overlaps ${first.jobTitle}`
            : 'This overlaps an existing booking',
        )
      }

      if (isEdit && event) {
        return updatePersonalCalendarEvent({
          id: event.id,
          title: trimmed,
          startAt,
          endAt,
        })
      }
      return createPersonalCalendarEvent({
        companyId,
        userId,
        title: trimmed,
        startAt,
        endAt,
      })
    },
    onSuccess: () => {
      invalidateCalendar()
      success(
        isEdit ? 'Event updated' : 'Event added',
        isEdit
          ? 'Your personal calendar event was saved.'
          : 'Colleagues can see this hold on the calendar.',
      )
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toastError('Could not save event', err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error('Nothing to delete')
      await deletePersonalCalendarEvent(event.id)
    },
    onSuccess: () => {
      invalidateCalendar()
      success('Event removed', 'That personal hold was deleted.')
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toastError('Could not delete', err.message)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>
          {readOnly
            ? 'Personal event'
            : isEdit
              ? 'Edit personal event'
              : 'Add personal event'}
        </Dialog.Title>
        <Dialog.Description size="2" color="gray" mt="1">
          {readOnly
            ? 'This hold is on a colleague’s calendar.'
            : 'A note on your calendar that the team can see. It also blocks overlapping crew bookings.'}
        </Dialog.Description>

        <Flex direction="column" gap="3" mt="4">
          <Text as="label" size="2" weight="medium">
            Title
            <TextField.Root
              mt="1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Accounting at the office"
              disabled={readOnly}
            />
          </Text>
          <DateTimeRangePicker
            startAt={startAt}
            endAt={endAt}
            onChange={(range) => {
              setStartAt(range.startAt)
              setEndAt(range.endAt)
            }}
            disabled={readOnly}
          />
        </Flex>

        <Flex gap="2" mt="4" justify="end">
          {isEdit && !readOnly && (
            <Button
              color="red"
              variant="soft"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || saveMutation.isPending}
            >
              Delete
            </Button>
          )}
          <Dialog.Close>
            <Button variant="soft">{readOnly ? 'Close' : 'Cancel'}</Button>
          </Dialog.Close>
          {!readOnly && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || deleteMutation.isPending}
            >
              {isEdit ? 'Save' : 'Add event'}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
