// src/features/jobs/components/dialogs/AddCrewDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Select,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { useAuthz } from '@shared/auth/useAuthz'
import { ForceBookingDialog } from '@features/conflicts/components/ForceBookingDialog'
import {
  findCrewOverlaps,
  getTimePeriodWindow,
} from '@features/conflicts/api/overlapChecks'
import {
  forcedBookingFields,
  isCrewOverlapError,
} from '@features/conflicts/api/forceBooking'
import type { OverlapConflict } from '@features/conflicts/api/overlapChecks'
import type { CrewReqStatus, UUID } from '../../types'

const defaultValues = {
  userId: '' as UUID | '',
  search: '',
  status: 'planned' as CrewReqStatus,
  timePeriodId: '',
}

const schema = z.object({
  userId: z.string().min(1, 'Choose a person'),
  search: z.string(),
  status: z.enum(['planned', 'confirmed', 'canceled']),
  timePeriodId: z.string().min(1, 'Choose a role/time period'),
})

export default function AddCrewDialog({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
}) {
  const qc = useQueryClient()
  const { userId: authUserId } = useAuthz()
  const [forceDialogOpen, setForceDialogOpen] = React.useState(false)
  const [forceConflicts, setForceConflicts] = React.useState<
    Array<OverlapConflict>
  >([])
  const [forceResourceLabel, setForceResourceLabel] = React.useState('')

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
    if (open) form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  const search = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.search,
  )

  const { data: people = [], isFetching } = useQuery({
    queryKey: ['crew-picker', search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .limit(20)

      if (search.trim()) {
        const term = search.trim()
        const patterns = [
          `%${term}%`,
          term.length > 2 ? `%${term.split('').join('%')}%` : null,
        ].filter(Boolean) as Array<string>

        const conditions = patterns
          .flatMap((pattern) => [
            `display_name.ilike.${pattern}`,
            `email.ilike.${pattern}`,
          ])
          .join(',')

        q = q.or(conditions)
      }

      const { data, error } = await q
      if (error) throw error
      return data as Array<{
        user_id: UUID
        display_name: string | null
        email: string
      }>
    },
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['jobs', jobId, 'time_periods', 'roles'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at')
        .eq('job_id', jobId)
        .eq('category', 'crew')
        .order('start_at', { ascending: true })

      if (error) throw error

      return data as Array<{
        id: string
        title: string | null
        start_at: string | null
        end_at: string | null
      }>
    },
  })

  React.useEffect(() => {
    if (!open) return
    const { timePeriodId } = form.state.values
    if (roles.length && !timePeriodId) {
      form.setFieldValue('timePeriodId', roles[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-select first role
  }, [open, roles])

  const save = useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}) => {
      const { userId, status, timePeriodId } = form.state.values
      if (!userId) throw new Error('Choose a person')
      if (!timePeriodId) throw new Error('Choose a role/time period')

      const window = await getTimePeriodWindow(timePeriodId)
      if (!force && window) {
        const overlaps = await findCrewOverlaps({
          userIds: [userId],
          startAt: window.startAt,
          endAt: window.endAt,
          excludePeriodId: timePeriodId,
        })
        const userConflicts = overlaps.get(userId) ?? []
        if (userConflicts.length > 0) {
          const person = people.find((p) => p.user_id === userId)
          setForceResourceLabel(
            person?.display_name ?? person?.email ?? 'Crew member',
          )
          setForceConflicts(userConflicts)
          setForceDialogOpen(true)
          throw new Error('OVERLAP_NEEDS_FORCE')
        }
      }

      const forcedFields =
        force && authUserId ? forcedBookingFields(authUserId) : {}

      const { error } = await supabase.from('reserved_crew').insert({
        time_period_id: timePeriodId,
        user_id: userId,
        status,
        ...forcedFields,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setForceDialogOpen(false)
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      await qc.invalidateQueries({ queryKey: ['conflicts'] })
      form.reset(defaultValues)
      onOpenChange(false)
    },
    onError: (e: Error) => {
      if (e.message === 'OVERLAP_NEEDS_FORCE') return
      const msg = e.message || 'Please try again.'
      if (isCrewOverlapError(msg) && !forceDialogOpen) {
        setForceResourceLabel('Selected crew')
        setForceConflicts([])
        setForceDialogOpen(true)
      }
    },
  })

  return (
    <>
      <Dialog.Root open={open && !forceDialogOpen} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>Add crew booking</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="2">
            Search for a person and add them to this job&apos;s crew time
            period.
          </Dialog.Description>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.AppForm>
              <Field label="Person">
                <form.AppField name="search">
                  {(field) => (
                    <TextField.Root
                      placeholder="Search name or email…"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                </form.AppField>
                <Box
                  mt="2"
                  p="2"
                  style={{
                    border: '1px solid var(--gray-a6)',
                    borderRadius: 8,
                    maxHeight: 220,
                    overflow: 'auto',
                  }}
                >
                  {isFetching && (
                    <Text size="2" color="gray">
                      Searching…
                    </Text>
                  )}
                  {!isFetching && people.length === 0 && (
                    <Text size="2" color="gray">
                      No results
                    </Text>
                  )}
                  {!isFetching &&
                    people.map((p, idx) => (
                      <form.Subscribe
                        key={p.user_id}
                        selector={(state) => state.values.userId}
                      >
                        {(userId) => (
                          <Box
                            p="2"
                            style={{
                              cursor: 'pointer',
                              borderRadius: 6,
                              background:
                                userId === p.user_id
                                  ? 'var(--blue-a3)'
                                  : 'transparent',
                            }}
                            onClick={() =>
                              form.setFieldValue('userId', p.user_id)
                            }
                          >
                            <Flex align="center" justify="between">
                              <div>
                                <Text weight="medium">
                                  {p.display_name ?? p.email}
                                </Text>
                                {p.display_name && (
                                  <Text
                                    size="1"
                                    color="gray"
                                    style={{ marginLeft: 6 }}
                                  >
                                    {p.email}
                                  </Text>
                                )}
                              </div>
                              {userId === p.user_id && (
                                <Text size="1" color="blue">
                                  Selected
                                </Text>
                              )}
                            </Flex>
                            {idx < people.length - 1 && <Separator my="2" />}
                          </Box>
                        )}
                      </form.Subscribe>
                    ))}
                </Box>
              </Field>

              <form.AppField name="timePeriodId">
                {(field) => (
                  <Field label="Role / Time period">
                    <Select.Root
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <Select.Trigger placeholder="Select role…" />
                      <Select.Content style={{ zIndex: 10000 }}>
                        {roles.map((tp) => (
                          <Select.Item key={tp.id} value={tp.id}>
                            {(tp.title || 'Untitled') +
                              ' — ' +
                              formatWhen(tp.start_at) +
                              ' → ' +
                              formatWhen(tp.end_at)}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Field>
                )}
              </form.AppField>

              <form.AppField name="status">
                {(field) => (
                  <Field label="Status">
                    <Select.Root
                      value={field.state.value}
                      onValueChange={(v: string) =>
                        field.handleChange(v as CrewReqStatus)
                      }
                    >
                      <Select.Trigger />
                      <Select.Content style={{ zIndex: 10000 }}>
                        <Select.Item value="planned">planned</Select.Item>
                        <Select.Item value="confirmed">confirmed</Select.Item>
                        <Select.Item value="canceled">canceled</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Field>
                )}
              </form.AppField>

              <Flex justify="end" gap="2" mt="3">
                <Dialog.Close>
                  <Button type="button" variant="soft">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton label="Add" pendingLabel="Saving…" />
              </Flex>
            </form.AppForm>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <ForceBookingDialog
        open={forceDialogOpen}
        onOpenChange={setForceDialogOpen}
        resourceLabel={forceResourceLabel}
        conflicts={forceConflicts}
        loading={save.isPending}
        onConfirm={() => save.mutate({ force: true })}
      />
    </>
  )
}

export function EditCrewDialog({
  open,
  onOpenChange,
  row,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: {
    id: UUID
    status: CrewReqStatus
    start_at: string | null
    end_at: string | null
  }
  jobId: UUID
}) {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState<CrewReqStatus>(row.status)

  React.useEffect(() => {
    if (!open) return
    setStatus(row.status)
  }, [open, row])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reserved_crew')
        .update({ status })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Edit crew booking</Dialog.Title>
        <Field label="Status">
          <Select.Root
            value={status}
            onValueChange={(v: string) => setStatus(v as CrewReqStatus)}
          >
            <Select.Trigger />
            <Select.Content style={{ zIndex: 10000 }}>
              <Select.Item value="planned">planned</Select.Item>
              <Select.Item value="confirmed">confirmed</Select.Item>
              <Select.Item value="canceled">canceled</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field>
        <Flex justify="end" gap="2" mt="3">
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

function formatWhen(iso?: string | null) {
  return iso
    ? new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
}
