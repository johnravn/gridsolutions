import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { DateTimeRangePicker } from '@shared/ui/components/pickers'

type InitialRole = {
  id: string
  title: string | null
  start_at: string | null
  end_at: string | null
  needed_count: number | null
  role_category: string | null
}

const defaultValues = {
  title: '',
  needed: 1,
  startAt: '',
  endAt: '',
  roleCategory: '',
}

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  needed: z.number().min(1, 'At least one person is required'),
  startAt: z.string().min(1, 'Start date is required'),
  endAt: z.string().min(1, 'End date is required'),
  roleCategory: z.string(),
})

function buildValuesFromInitial(initial: InitialRole): typeof defaultValues {
  return {
    title: initial.title ?? '',
    needed: initial.needed_count ?? 1,
    startAt: initial.start_at ?? '',
    endAt: initial.end_at ?? '',
    roleCategory: initial.role_category ?? '',
  }
}

export default function EditRoleDialog({
  open,
  onOpenChange,
  jobId,
  initial,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  initial: InitialRole | null
}) {
  const qc = useQueryClient()
  const { error: toastError, success } = useToast()
  const [neededDraft, setNeededDraft] = React.useState<string | null>(null)

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
    if (!open || !initial) return
    form.reset(buildValuesFromInitial(initial), { keepDefaultValues: true })
    setNeededDraft(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, initial?.id])

  const save = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!initial?.id) throw new Error('Missing role')

      const payload = {
        title: value.title.trim(),
        start_at: value.startAt,
        end_at: value.endAt,
        needed_count: value.needed,
        role_category: value.roleCategory.trim().toLowerCase() || null,
      }

      const { error } = await supabase
        .from('time_periods')
        .update(payload)
        .eq('id', initial.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'time_periods', 'crew'],
      })
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      success('Role updated', 'Role details saved.')
      onOpenChange(false)
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to update role',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Edit role</Dialog.Title>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <form.AppField name="title">
                {(field) => (
                  <field.TextField
                    label="Title"
                    placeholder="e.g. FOH, Monitor, Loader"
                  />
                )}
              </form.AppField>

              <form.AppField name="needed">
                {(field) => (
                  <Box>
                    <Text size="2" color="gray" mb="1">
                      Needed
                    </Text>
                    <TextField.Root
                      type="number"
                      min="1"
                      value={neededDraft ?? String(field.state.value)}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        setNeededDraft(nextValue)

                        if (nextValue === '') return
                        const parsed = Number(nextValue)
                        if (Number.isNaN(parsed)) return

                        field.handleChange(Math.max(1, parsed))
                        setNeededDraft(null)
                      }}
                      onBlur={() => {
                        field.handleBlur()
                        if (neededDraft === '') {
                          setNeededDraft(null)
                        }
                      }}
                      style={{ width: 120 }}
                    />
                  </Box>
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
                  />
                )}
              </form.Subscribe>

              <form.AppField name="roleCategory">
                {(field) => (
                  <field.TextField
                    label="Role Category"
                    placeholder="e.g. Audio, Lights, AV"
                  />
                )}
              </form.AppField>
            </Flex>

            <Flex justify="end" gap="2" mt="4">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton
                label="Save role"
                pendingLabel="Saving…"
                disabled={!initial?.id}
              />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
