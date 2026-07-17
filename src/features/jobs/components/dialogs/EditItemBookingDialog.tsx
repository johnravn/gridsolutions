// src/features/jobs/components/dialogs/EditItemBookingDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex, Select, TextField } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { useAuthz } from '@shared/auth/useAuthz'
import { DateTimeRangePicker } from '@shared/ui/components/pickers'
import { ForceBookingDialog } from '@features/conflicts/components/ForceBookingDialog'
import {
  forcedBookingFields,
  isEquipmentCapacityError,
} from '@features/conflicts/api/forceBooking'
import type { ExternalReqStatus, ReservedItemRow } from '../../types'

const defaultValues = {
  quantity: 1,
  status: 'planned' as ExternalReqStatus,
  note: '',
  useTimePeriodWindow: true,
  lineStart: '',
  lineEnd: '',
}

const schema = z.object({
  quantity: z.number().min(1),
  status: z.enum(['planned', 'requested', 'confirmed']),
  note: z.string(),
  useTimePeriodWindow: z.boolean(),
  lineStart: z.string(),
  lineEnd: z.string(),
})

export default function EditItemBookingDialog({
  open,
  onOpenChange,
  row,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: ReservedItemRow
  jobId: string
}) {
  const qc = useQueryClient()
  const { userId: authUserId } = useAuthz()
  const [forceDialogOpen, setForceDialogOpen] = React.useState(false)
  const [forceWarnings, setForceWarnings] = React.useState<Array<string>>([])
  const [quantityDraft, setQuantityDraft] = React.useState<string | null>(null)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({ value })
    },
  })

  React.useEffect(() => {
    if (!open) return
    setQuantityDraft(null)
    form.reset(
      {
        quantity: row.quantity,
        status: (row.external_status as ExternalReqStatus) ?? 'planned',
        note: row.external_note ?? '',
        useTimePeriodWindow: !row.start_at && !row.end_at,
        lineStart: row.start_at || '',
        lineEnd: row.end_at || '',
      },
      { keepDefaultValues: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [
    open,
    row.id,
    row.quantity,
    row.external_status,
    row.external_note,
    row.start_at,
    row.end_at,
  ])

  const save = useMutation({
    mutationFn: async ({
      value,
      force = false,
    }: {
      value: typeof defaultValues
      force?: boolean
    }) => {
      const payload: Record<string, unknown> = {
        quantity: value.quantity,
        external_status: value.status,
        external_note: value.note,
      }
      if (value.useTimePeriodWindow) {
        payload.start_at = null
        payload.end_at = null
      } else {
        payload.start_at = value.lineStart || null
        payload.end_at = value.lineEnd || null
      }
      if (force && authUserId) {
        Object.assign(payload, forcedBookingFields(authUserId))
      }
      const { error } = await supabase
        .from('reserved_items')
        .update(payload)
        .eq('id', row.id)

      if (error) throw error
    },
    onSuccess: async () => {
      setForceDialogOpen(false)
      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      await qc.invalidateQueries({ queryKey: ['conflicts'] })
      onOpenChange(false)
    },
    onError: (e: any) => {
      const msg = e?.hint || e?.message || 'Please try again.'
      if (isEquipmentCapacityError(msg) && !forceDialogOpen) {
        setForceWarnings([msg])
        setForceDialogOpen(true)
      }
    },
  })

  return (
    <>
      <Dialog.Root open={open && !forceDialogOpen} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="460px">
          <Dialog.Title>Edit item booking</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="2">
            Update the quantity for this equipment booking.
          </Dialog.Description>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.AppForm>
              <Field label="Quantity">
                <form.AppField name="quantity">
                  {(field) => (
                    <TextField.Root
                      type="number"
                      min="1"
                      value={quantityDraft ?? String(field.state.value)}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        setQuantityDraft(nextValue)

                        if (nextValue === '') return
                        const parsed = Number(nextValue)
                        if (Number.isNaN(parsed)) return

                        field.handleChange(Math.max(1, parsed))
                        setQuantityDraft(null)
                      }}
                      onBlur={() => {
                        if (quantityDraft === '') {
                          setQuantityDraft(null)
                        }
                        field.handleBlur()
                      }}
                    />
                  )}
                </form.AppField>
              </Field>
              <Field label="External status">
                <form.AppField name="status">
                  {(field) => (
                    <Select.Root
                      value={field.state.value}
                      onValueChange={(v) =>
                        field.handleChange(v as ExternalReqStatus)
                      }
                    >
                      <Select.Trigger />
                      <Select.Content style={{ zIndex: 10000 }}>
                        <Select.Item value="planned">planned</Select.Item>
                        <Select.Item value="requested">requested</Select.Item>
                        <Select.Item value="confirmed">confirmed</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  )}
                </form.AppField>
              </Field>
              <Field label="Note">
                <form.AppField name="note">
                  {(field) => <field.TextField placeholder="Optional" />}
                </form.AppField>
              </Field>
              <Field label="Timing">
                <form.AppField name="useTimePeriodWindow">
                  {(field) => (
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <input
                        type="checkbox"
                        checked={field.state.value}
                        onChange={(e) => field.handleChange(e.target.checked)}
                      />
                      <span>Use time period window</span>
                    </label>
                  )}
                </form.AppField>
                <form.Subscribe
                  selector={(state) => state.values.useTimePeriodWindow}
                >
                  {(useTimePeriodWindow) =>
                    !useTimePeriodWindow && (
                      <Box mt="2">
                        <form.AppField name="lineStart">
                          {(startField) => (
                            <form.AppField name="lineEnd">
                              {(endField) => (
                                <DateTimeRangePicker
                                  startAt={startField.state.value}
                                  endAt={endField.state.value}
                                  onChange={({ startAt: s, endAt: e }) => {
                                    startField.handleChange(s)
                                    endField.handleChange(e)
                                  }}
                                />
                              )}
                            </form.AppField>
                          )}
                        </form.AppField>
                      </Box>
                    )
                  }
                </form.Subscribe>
              </Field>

              <Flex justify="end" gap="2" mt="3">
                <Dialog.Close>
                  <Button type="button" variant="soft">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton label="Save" pendingLabel="Saving…" />
              </Flex>
            </form.AppForm>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <ForceBookingDialog
        open={forceDialogOpen}
        onOpenChange={setForceDialogOpen}
        resourceLabel={
          Array.isArray(row.item)
            ? (row.item[0]?.name ?? 'Item booking')
            : (row.item?.name ?? 'Item booking')
        }
        warningLines={forceWarnings}
        loading={save.isPending}
        onConfirm={() => save.mutate({ value: form.state.values, force: true })}
      />
    </>
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
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          color: 'var(--gray-11)',
          fontSize: 'var(--font-size-2)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}
