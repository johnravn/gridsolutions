import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { AnimatedQuickSuggestions } from '@shared/ui/components/AnimatedQuickSuggestions'
import { DateTimeRangePicker } from '@shared/ui/components/pickers'
import { jobDetailQuery } from '@features/jobs/api/queries'

const TITLE_SUGGESTIONS = [
  'Technician',
  'Loader',
  'FOH',
  'Monitors',
  'Hands',
  'Driver',
]

const CATEGORY_SUGGESTIONS = ['Audio', 'Lights', 'AV', 'Transport', 'Rigging']

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

export default function AddRoleDialog({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
}) {
  const qc = useQueryClient()
  const [neededDraft, setNeededDraft] = React.useState<string | null>(null)
  const [focusedField, setFocusedField] = React.useState<
    'title' | 'category' | null
  >(null)

  // Prefer the job-page cache so start/end are available on first open render.
  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
    enabled: open,
  })

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
        title: '',
        needed: 1,
        startAt: job?.start_at ?? '',
        endAt: job?.end_at ?? '',
        roleCategory: '',
      },
      { keepDefaultValues: true },
    )
    setNeededDraft(null)
    setFocusedField(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  // If job times weren't cached on open, seed empty period fields once they load.
  // Only fill blanks so we don't overwrite a period the user already edited.
  React.useEffect(() => {
    if (!open || !job) return
    if (!form.getFieldValue('startAt') && job.start_at) {
      form.setFieldValue('startAt', job.start_at)
    }
    if (!form.getFieldValue('endAt') && job.end_at) {
      form.setFieldValue('endAt', job.end_at)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fill defaults when job times load
  }, [open, job?.start_at, job?.end_at])

  const save = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!job?.company_id) throw new Error('Missing company')

      const payload = {
        job_id: jobId,
        company_id: job.company_id,
        title: value.title.trim(),
        start_at: value.startAt,
        end_at: value.endAt,
        needed_count: value.needed,
        category: 'crew' as const,
        role_category: value.roleCategory.trim().toLowerCase() || undefined,
      }

      const { error } = await supabase.from('time_periods').insert(payload)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'time_periods', 'crew'],
      })
      form.reset(defaultValues, { keepDefaultValues: true })
      setNeededDraft(null)
      setFocusedField(null)
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Add role</Dialog.Title>
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
                  <Box>
                    <Text size="2" color="gray" mb="1">
                      Title
                    </Text>
                    <TextField.Root
                      placeholder="e.g. FOH, Monitor, Loader"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      onFocus={() => setFocusedField('title')}
                    />
                    <AnimatedQuickSuggestions
                      suggestions={TITLE_SUGGESTIONS}
                      open={focusedField === 'title'}
                      staticOpen={!field.state.value.trim()}
                      showLabel
                      onSelect={(value) => field.handleChange(value)}
                      onAfterSelect={() => setFocusedField(null)}
                    />
                  </Box>
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
                  <Box>
                    <Text size="2" color="gray" mb="1">
                      Role Category
                    </Text>
                    <TextField.Root
                      placeholder="e.g. Audio, Lights, AV"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      onFocus={() => setFocusedField('category')}
                    />
                    <AnimatedQuickSuggestions
                      suggestions={CATEGORY_SUGGESTIONS}
                      open={focusedField === 'category'}
                      staticOpen
                      showLabel
                      onSelect={(value) => field.handleChange(value)}
                      onAfterSelect={() => setFocusedField(null)}
                    />
                  </Box>
                )}
              </form.AppField>
            </Flex>

            <Flex justify="end" gap="2" mt="4">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton label="Add role" pendingLabel="Saving…" />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
