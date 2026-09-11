import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Text,
  TextField,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { AnimatedQuickSuggestions } from '@shared/ui/components/AnimatedQuickSuggestions'
import { DateTimeRangePicker } from '@shared/ui/components/pickers'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { ForceBookingDialog } from '@features/conflicts/components/ForceBookingDialog'
import { findCrewOverlaps } from '@features/conflicts/api/overlapChecks'
import {
  OVERLAP_NEEDS_FORCE,
  forcedBookingFields,
  isCrewOverlapError,
} from '@features/conflicts/api/forceBooking'
import { jobDetailQuery } from '@features/jobs/api/queries'
import type { ProgressToastHandle } from '@shared/ui/toast/ToastProvider'
import type { OverlapConflict } from '@features/conflicts/api/overlapChecks'

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
  confirmMyself: false,
}

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  needed: z.number().min(1, 'At least one person is required'),
  startAt: z.string().min(1, 'Start date is required'),
  endAt: z.string().min(1, 'End date is required'),
  roleCategory: z.string(),
  confirmMyself: z.boolean(),
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
  const { progress } = useToast()
  const { userId: currentUserId } = useAuthz()
  const [neededDraft, setNeededDraft] = React.useState<string | null>(null)
  const [focusedField, setFocusedField] = React.useState<
    'title' | 'category' | null
  >(null)
  const [forceDialogOpen, setForceDialogOpen] = React.useState(false)
  const [forceConflicts, setForceConflicts] = React.useState<
    Array<OverlapConflict>
  >([])
  const createdPeriodIdRef = React.useRef<string | null>(null)
  const addRoleProgressRef = React.useRef<ProgressToastHandle | null>(null)

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
    onSubmit: async () => {
      await save.mutateAsync({})
    },
  })

  React.useEffect(() => {
    if (!open) return
    createdPeriodIdRef.current = null
    setForceDialogOpen(false)
    setForceConflicts([])
    form.reset(
      {
        title: '',
        needed: 1,
        startAt: job?.start_at ?? '',
        endAt: job?.end_at ?? '',
        roleCategory: '',
        confirmMyself: false,
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
    mutationFn: async (vars?: { force?: boolean }) => {
      addRoleProgressRef.current?.dismiss()
      const p = progress('Adding role…')
      addRoleProgressRef.current = p
      const force = vars?.force ?? false
      const value = form.state.values
      if (!job?.company_id) throw new Error('Missing company')

      const confirmMyself = value.confirmMyself && !!currentUserId

      if (confirmMyself && currentUserId && !force) {
        const overlaps = await findCrewOverlaps({
          userIds: [currentUserId],
          startAt: value.startAt,
          endAt: value.endAt,
        })
        const conflicts = overlaps.get(currentUserId) ?? []
        if (conflicts.length > 0) {
          setForceConflicts(conflicts)
          setForceDialogOpen(true)
          p.dismiss()
          addRoleProgressRef.current = null
          throw new Error(OVERLAP_NEEDS_FORCE)
        }
      }

      let periodId = createdPeriodIdRef.current
      if (!periodId) {
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

        const { data: period, error } = await supabase
          .from('time_periods')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        periodId = period.id
        createdPeriodIdRef.current = periodId
      }

      if (confirmMyself && currentUserId && periodId) {
        const forcedFields =
          force && currentUserId ? forcedBookingFields(currentUserId) : {}
        const { error: crewError } = await supabase
          .from('reserved_crew')
          .insert({
            time_period_id: periodId,
            user_id: currentUserId,
            status: 'confirmed' as const,
            notes: null,
            ...forcedFields,
          })
        if (crewError) throw crewError
      }

      return { confirmed: confirmMyself }
    },
    onSuccess: (result) => {
      setForceDialogOpen(false)
      createdPeriodIdRef.current = null
      form.reset(defaultValues, { keepDefaultValues: true })
      setNeededDraft(null)
      setFocusedField(null)
      onOpenChange(false)
      addRoleProgressRef.current?.success(
        'Role added',
        result?.confirmed
          ? 'Role added with you as confirmed crew'
          : 'Role saved',
      )
      addRoleProgressRef.current = null
      void Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] }),
        qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] }),
        qc.invalidateQueries({
          queryKey: ['jobs', jobId, 'time_periods', 'crew'],
        }),
        qc.invalidateQueries({ queryKey: ['conflicts'] }),
      ])
    },
    onError: (e: Error) => {
      if (e.message === OVERLAP_NEEDS_FORCE) return
      const msg = e.message || 'Please try again.'
      if (isCrewOverlapError(msg) && !forceDialogOpen) {
        addRoleProgressRef.current?.dismiss()
        addRoleProgressRef.current = null
        setForceConflicts([])
        setForceDialogOpen(true)
        return
      }
      addRoleProgressRef.current?.error('Failed to add role', msg)
      addRoleProgressRef.current = null
    },
  })

  return (
    <>
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
                  selector={(state) => [
                    state.values.startAt,
                    state.values.endAt,
                  ]}
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

              <Flex justify="between" align="center" gap="3" mt="4" wrap="wrap">
                {currentUserId ? (
                  <form.AppField name="confirmMyself">
                    {(field) => (
                      <Text as="label" size="2">
                        <Flex align="center" gap="2">
                          <Checkbox
                            checked={field.state.value}
                            onCheckedChange={(checked) =>
                              field.handleChange(checked === true)
                            }
                          />
                          Confirm myself
                        </Flex>
                      </Text>
                    )}
                  </form.AppField>
                ) : (
                  <span />
                )}
                <Flex gap="2">
                  <Dialog.Close>
                    <Button type="button" variant="soft">
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <form.Subscribe
                    selector={(state) => state.values.confirmMyself}
                  >
                    {(confirmMyself) => (
                      <form.SubmitButton
                        label={
                          confirmMyself && currentUserId
                            ? 'Add and confirm myself'
                            : 'Add role'
                        }
                        pendingLabel="Saving…"
                      />
                    )}
                  </form.Subscribe>
                </Flex>
              </Flex>
            </form.AppForm>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <ForceBookingDialog
        open={forceDialogOpen}
        onOpenChange={setForceDialogOpen}
        resourceLabel="You"
        conflicts={forceConflicts}
        loading={save.isPending}
        onConfirm={() => save.mutate({ force: true })}
      />
    </>
  )
}
