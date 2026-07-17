// src/features/vehicles/components/dialogs/BookPersonalVehicleDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  DateTimeRangePicker,
  isInvalidTimeRange,
} from '@shared/ui/components/pickers'
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

const defaultValues = {
  title: '',
  startAt: '',
  endAt: '',
}

const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    startAt: z.string().min(1, 'Start time is required'),
    endAt: z.string().min(1, 'End time is required'),
  })
  .refine((v) => !isInvalidTimeRange(v.startAt, v.endAt), {
    message: 'End time must be after start time.',
    path: ['endAt'],
  })

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

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      if (mode === 'create') {
        await createMut.mutateAsync(value)
      } else {
        await updateMut.mutateAsync(value)
      }
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (mode === 'edit' && initial) {
      form.reset(
        {
          title: initial.title,
          startAt: initial.startAt,
          endAt: initial.endAt,
        },
        { keepDefaultValues: true },
      )
    } else {
      form.reset(defaultValues, { keepDefaultValues: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [
    open,
    mode,
    initial?.timePeriodId,
    initial?.title,
    initial?.startAt,
    initial?.endAt,
  ])

  const createMut = useMutation({
    mutationFn: async (value: typeof defaultValues) =>
      createPersonalVehicleBooking({
        companyId,
        vehicleId,
        title: value.title.trim() || 'Personal booking',
        startAt: value.startAt,
        endAt: value.endAt,
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
        err instanceof Error
          ? err.message
          : 'Vehicle may already be booked for this period.',
      )
    },
  })

  const updateMut = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!initial) throw new Error('No booking to update')
      await updatePersonalVehicleBooking({
        timePeriodId: initial.timePeriodId,
        title: value.title.trim() || undefined,
        startAt: value.startAt,
        endAt: value.endAt,
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
      showError(
        'Failed to update',
        err instanceof Error ? err.message : 'Please try again.',
      )
    },
  })

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>
          {mode === 'create' ? 'Book vehicle' : 'Edit booking'}
        </Dialog.Title>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Box
              mt="4"
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <form.AppField name="title">
                {(field) => (
                  <field.TextField
                    label="Title"
                    placeholder="e.g. Personal errand"
                  />
                )}
              </form.AppField>

              <form.Subscribe
                selector={(state) => [state.values.startAt, state.values.endAt]}
              >
                {([startAt, endAt]) => (
                  <DateTimeRangePicker
                    startAt={startAt}
                    endAt={endAt}
                    onChange={({ startAt: s, endAt: e }) => {
                      form.setFieldValue('startAt', s)
                      form.setFieldValue('endAt', e)
                    }}
                    invalid={isInvalidTimeRange(startAt, endAt)}
                  />
                )}
              </form.Subscribe>

              <Flex justify="end" gap="2" mt="2">
                <Dialog.Close>
                  <Button type="button" variant="soft">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton
                  label={mode === 'create' ? 'Book' : 'Save'}
                  pendingLabel="Saving…"
                  disabled={isPending}
                />
              </Flex>
            </Box>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
