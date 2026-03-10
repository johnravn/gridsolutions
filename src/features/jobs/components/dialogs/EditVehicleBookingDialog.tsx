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
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import type { ExternalReqStatus } from '../../types'

type EditVehicleBookingRow = {
  id: string
  external_status: ExternalReqStatus | null
  external_note: string | null
}

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
  const [status, setStatus] = React.useState<ExternalReqStatus>(
    row.external_status ?? 'planned',
  )
  const [note, setNote] = React.useState(row.external_note ?? '')

  React.useEffect(() => {
    if (!open) return
    setStatus(row.external_status ?? 'planned')
    setNote(row.external_note ?? '')
  }, [open, row])

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        external_status: status,
        external_note: note.trim() || null,
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

        <Box
          mt="4"
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <Field label="Status">
            <SegmentedControl.Root
              size="2"
              value={status}
              onValueChange={(v) => setStatus(v as ExternalReqStatus)}
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
          </Field>

          <Field label="Note">
            <TextField.Root
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note…"
            />
          </Field>

          <Flex justify="end" gap="2" mt="2">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="solid"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </Flex>
        </Box>
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
