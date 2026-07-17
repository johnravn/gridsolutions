// src/features/jobs/components/dialogs/EditVehicleBookingDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  SegmentedControl,
  Text,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import type { ExternalReqStatus } from '../../types'

type EditVehicleBookingRow = {
  id: string
  external_status: ExternalReqStatus | null
  external_note: string | null
}

const defaultValues = {
  status: 'planned' as ExternalReqStatus,
  note: '',
}

const schema = z.object({
  status: z.enum(['planned', 'requested', 'confirmed']),
  note: z.string(),
})

export default function EditVehicleBookingDialog({
  open,
  onOpenChange,
  row,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: EditVehicleBookingRow
  jobId: string
}) {
  const qc = useQueryClient()
  const { success, error: showError } = useToast()

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset(
      {
        status: row.external_status ?? 'planned',
        note: row.external_note ?? '',
      },
      { keepDefaultValues: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, row.id, row.external_status, row.external_note])

  const save = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      const payload: any = {
        external_status: value.status,
        external_note: value.note.trim() || null,
      }

      const { error } = await supabase
        .from('reserved_vehicles')
        .update(payload)
        .eq('id', row.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      success('Updated', 'Vehicle booking updated')
      onOpenChange(false)
    },
    onError: (err: any) => {
      showError('Failed to update', err?.message || 'Please try again.')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Edit vehicle booking</Dialog.Title>

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
              <Field label="Status">
                <form.AppField name="status">
                  {(field) => (
                    <SegmentedControl.Root
                      size="2"
                      value={field.state.value}
                      onValueChange={(v) =>
                        field.handleChange(v as ExternalReqStatus)
                      }
                    >
                      <SegmentedControl.Item value="planned">
                        Planned
                      </SegmentedControl.Item>
                      <SegmentedControl.Item value="requested">
                        Requested
                      </SegmentedControl.Item>
                      <SegmentedControl.Item value="confirmed">
                        Confirmed
                      </SegmentedControl.Item>
                    </SegmentedControl.Root>
                  )}
                </form.AppField>
              </Field>

              <form.AppField name="note">
                {(field) => (
                  <field.TextField label="Note" placeholder="Optional note…" />
                )}
              </form.AppField>

              <Flex justify="end" gap="2" mt="2">
                <Dialog.Close>
                  <Button type="button" variant="soft">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton label="Save" pendingLabel="Saving…" />
              </Flex>
            </Box>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Text size="2" weight="medium" mb="2" as="div">
        {label}
      </Text>
      {children}
    </Box>
  )
}
