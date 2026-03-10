// src/features/vehicles/components/dialogs/BookPersonalVehicleDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { addThreeHours } from '@shared/lib/generalFunctions'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import {
  createPersonalVehicleBooking,
  updatePersonalVehicleBooking,
} from '../../api/queries'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  companyId: string
  vehicleId: string
  /** For edit mode: existing booking data */
  initial?: {
    timePeriodId: string
    title: string
    startAt: string
    endAt: string
  }
  onSaved?: () => void
}

export default function BookPersonalVehicleDialog({
  open,
  onOpenChange,
  mode,
  companyId,
  vehicleId,
  initial,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const [title, setTitle] = React.useState(initial?.title ?? '')
  const [startAt, setStartAt] = React.useState(initial?.startAt ?? '')
  const [endAt, setEndAt] = React.useState(initial?.endAt ?? '')
  const [autoSetEnd, setAutoSetEnd] = React.useState(true)

  React.useEffect(() => {
    if (!open) return
    if (mode === 'edit' && initial) {
      setTitle(initial.title)
      setStartAt(initial.startAt)
      setEndAt(initial.endAt)
      setAutoSetEnd(false)
    } else {
      setTitle('')
      const now = new Date()
      const start = new Date(now.getTime() + 60 * 60 * 1000)
      start.setMinutes(0, 0, 0)
      const end = addThreeHours(start.toISOString())
      setStartAt(start.toISOString())
      setEndAt(end)
      setAutoSetEnd(true)
    }
  }, [open, mode, initial])

  React.useEffect(() => {
    if (!open || !autoSetEnd || mode === 'edit') return
    if (startAt) setEndAt(addThreeHours(startAt))
  }, [startAt, autoSetEnd, open, mode])

  const createMut = useMutation({
    mutationFn: () =>
      createPersonalVehicleBooking({
        companyId,
        vehicleId,
        title: title.trim() || 'Personal booking',
        startAt,
        endAt,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'vehicle-calendar'],
        exact: false,
      })
      success('Booked', 'Personal booking created')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (err: unknown) => {
      showError(
        'Failed to create booking',
        (err as Error)?.message ||
          'Vehicle may already be booked for this period.',
      )
    },
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!initial) throw new Error('No booking to update')
      await updatePersonalVehicleBooking({
        timePeriodId: initial.timePeriodId,
        title: title.trim() || undefined,
        startAt,
        endAt,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'vehicle-calendar'],
        exact: false,
      })
      success('Updated', 'Personal booking updated')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (err: unknown) => {
      showError('Failed to update', (err as Error)?.message ?? 'Please try again.')
    },
  })

  const save = mode === 'create' ? createMut.mutate : updateMut.mutate
  const isPending = createMut.isPending || updateMut.isPending
  const canSave =
    title.trim().length > 0 && startAt && endAt && new Date(endAt) > new Date(startAt)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>
          {mode === 'create' ? 'Book vehicle' : 'Edit booking'}
        </Dialog.Title>

        <Box mt="4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              Title
            </Text>
            <TextField.Root
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Personal errand"
            />
          </Box>

          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <DateTimePicker
                label="Start"
                value={startAt}
                onChange={(v) => {
                  setStartAt(v)
                  setAutoSetEnd(true)
                }}
              />
            </Box>
            <Box style={{ flex: 1 }}>
              <DateTimePicker
                label="End"
                value={endAt}
                onChange={(v) => {
                  setEndAt(v)
                  setAutoSetEnd(false)
                }}
              />
            </Box>
          </Flex>

          <Flex justify="end" gap="2" mt="2">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="solid"
              onClick={() => save()}
              disabled={isPending || !canSave}
            >
              {isPending ? 'Saving…' : mode === 'create' ? 'Book' : 'Save'}
            </Button>
          </Flex>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  )
}
