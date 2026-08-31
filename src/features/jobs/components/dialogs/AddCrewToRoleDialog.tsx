// src/features/jobs/components/dialogs/AddCrewToRoleDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { Check, Mail, UserPlus } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
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
import { sendCrewInvite } from '@features/matters/api/queries'
import {
  addMemberOrInvite,
  crewInternalNotesQuery,
} from '../../../crew/api/queries'
import { jobDetailQuery } from '../../api/queries'
import { recentCustomerCrewQuery } from '../../api/recentCustomerCrewQuery'
import {
  addCrewActionLabels,
  selectedUserIdsToInvite,
} from '../../utils/addCrewActionLabels'
import { splitCrewPickerPeople } from '../../utils/rankRecentCustomerCrew'
import type { OverlapConflict } from '@features/conflicts/api/overlapChecks'
import type { RecentCustomerCrewPerson } from '../../utils/rankRecentCustomerCrew'
import type { UUID } from '../../types'

type CrewPickerPerson = RecentCustomerCrewPerson

const defaultValues = {
  search: '',
  selectedIds: [] as Array<UUID>,
  placeholderName: '',
  placeholderEmail: '',
}

const schema = z.object({
  search: z.string(),
  selectedIds: z
    .array(z.string())
    .min(1, 'Please select at least one crew member'),
  placeholderName: z.string(),
  placeholderEmail: z.string(),
})

export default function AddCrewToRoleDialog({
  open,
  onOpenChange,
  jobId,
  timePeriodId,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  timePeriodId: UUID
  companyId: UUID
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const { companyRole, isGlobalSuperuser, userId: authUserId } = useAuthz()
  const [forceDialogOpen, setForceDialogOpen] = React.useState(false)
  const [forceConflicts, setForceConflicts] = React.useState<
    Array<OverlapConflict>
  >([])
  const [forceResourceLabel, setForceResourceLabel] = React.useState('')
  const [expandedPanel, setExpandedPanel] = React.useState<
    'placeholder' | 'invite' | null
  >(null)
  const [pendingInvite, setPendingInvite] = React.useState(false)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async () => {
      await runAddCrew({ invite: true })
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues)
      setExpandedPanel(null)
      setPendingInvite(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  const search = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.search,
  )
  const placeholderName = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.placeholderName,
  )
  const placeholderEmail = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.placeholderEmail,
  )

  const canSeeInternalNotes =
    !!isGlobalSuperuser ||
    companyRole === 'owner' ||
    companyRole === 'employee' ||
    companyRole === 'super_user'

  const { data: internalNotes = [] } = useQuery({
    ...crewInternalNotesQuery({ companyId }),
    enabled: open && canSeeInternalNotes,
  })

  const internalNotesByUserId = React.useMemo(() => {
    const m: Record<string, string> = {}
    for (const n of internalNotes) {
      if (n.note && n.note.trim()) m[n.user_id] = n.note
    }
    return m
  }, [internalNotes])

  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
    enabled: open,
  })
  const customerId = job?.customer_id ?? null

  const { data: recentCrew = [] } = useQuery({
    ...recentCustomerCrewQuery({
      companyId,
      customerId: customerId ?? '',
    }),
    enabled: open && !!customerId,
  })

  const { data: existingCrew = [] } = useQuery({
    queryKey: ['jobs.crew', jobId, 'role', timePeriodId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reserved_crew')
        .select('user_id')
        .eq('time_period_id', timePeriodId)
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      return rows as Array<{ user_id: UUID }>
    },
  })

  const existingUserIds = React.useMemo(
    () => new Set(existingCrew.map((c) => c.user_id)),
    [existingCrew],
  )

  const { data: people = [], isFetching } = useQuery({
    queryKey: ['crew-picker', search, timePeriodId, existingUserIds.size],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .limit(50)

      if (search.trim()) {
        q = q.or(
          `display_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`,
        )
      }

      const { data, error } = await q
      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      return rows.filter((p) => !existingUserIds.has(p.user_id)) as Array<{
        user_id: UUID
        display_name: string | null
        email: string
      }>
    },
  })

  const suggestedForRole = React.useMemo(
    () => recentCrew.filter((person) => !existingUserIds.has(person.user_id)),
    [recentCrew, existingUserIds],
  )

  const { suggested, rest } = React.useMemo(
    () => splitCrewPickerPeople(people, suggestedForRole, search),
    [people, suggestedForRole, search],
  )

  const pickerPeople = React.useMemo(() => {
    const seen = new Set<string>()
    const merged: Array<CrewPickerPerson> = []
    for (const person of [...suggestedForRole, ...people]) {
      if (seen.has(person.user_id)) continue
      seen.add(person.user_id)
      merged.push(person)
    }
    return merged
  }, [suggestedForRole, people])

  const toggleSelection = (userId: UUID) => {
    const current = form.state.values.selectedIds
    const next = current.includes(userId)
      ? current.filter((id: UUID) => id !== userId)
      : [...current, userId]
    form.setFieldValue('selectedIds', next)
  }

  const save = useMutation({
    mutationFn: async ({
      force = false,
      invite = false,
      selectedIds: selectedIdsArg,
    }: {
      force?: boolean
      invite?: boolean
      selectedIds?: Array<UUID>
    } = {}) => {
      const selectedIds = selectedIdsArg ?? [...form.state.values.selectedIds]
      if (selectedIds.length === 0) {
        throw new Error('Please select at least one crew member')
      }

      const window = await getTimePeriodWindow(timePeriodId)
      if (!force && window) {
        const overlaps = await findCrewOverlaps({
          userIds: selectedIds,
          startAt: window.startAt,
          endAt: window.endAt,
          excludePeriodId: timePeriodId,
        })
        if (overlaps.size > 0) {
          const allConflicts: Array<OverlapConflict> = []
          const names: Array<string> = []
          for (const [userId, conflicts] of overlaps) {
            const person = pickerPeople.find((p) => p.user_id === userId)
            names.push(person?.display_name ?? person?.email ?? 'Crew member')
            allConflicts.push(...conflicts)
          }
          setForceResourceLabel(names.join(', '))
          setForceConflicts(allConflicts)
          setForceDialogOpen(true)
          throw new Error('OVERLAP_NEEDS_FORCE')
        }
      }

      const forcedFields =
        force && authUserId ? forcedBookingFields(authUserId) : {}

      const payload = selectedIds.map((userId: UUID) => ({
        time_period_id: timePeriodId,
        user_id: userId,
        status: 'planned' as const,
        notes: null,
        ...forcedFields,
      }))

      const { error } = await supabase.from('reserved_crew').insert(payload)
      if (error) throw error

      let invited = false
      let inviteError: string | null = null
      if (invite) {
        const toInvite = selectedUserIdsToInvite(selectedIds, authUserId)
        if (toInvite.length === 0) {
          inviteError =
            'You can’t send a crew invitation to yourself. The booking was added without an invite.'
        } else {
          try {
            for (const userId of toInvite) {
              await sendCrewInvite(jobId, timePeriodId, userId, companyId)
            }
            invited = true
          } catch (e) {
            inviteError = e instanceof Error ? e.message : 'Please try again.'
          }
        }
      }

      return {
        count: selectedIds.length,
        invited,
        inviteError,
      }
    },
    onSuccess: (result) => {
      setForceDialogOpen(false)
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'time_periods', 'crew'],
      })
      qc.invalidateQueries({ queryKey: ['conflicts'] })
      if (result.invited || result.inviteError) {
        qc.invalidateQueries({ queryKey: ['matters'] })
      }
      if (result.inviteError) {
        toastError('Crew added, but invite failed', result.inviteError)
      } else if (result.invited) {
        success(
          'Success',
          `Added and invited ${result.count} crew member${result.count !== 1 ? 's' : ''}`,
        )
      } else {
        success(
          'Success',
          `Added ${result.count} crew member${result.count !== 1 ? 's' : ''} to role`,
        )
      }
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
        return
      }
      toastError('Failed to add crew', msg)
    },
  })

  const runAddCrew = async ({ invite }: { invite: boolean }) => {
    const selectedIds = [...form.state.values.selectedIds]
    setPendingInvite(invite)
    try {
      await save.mutateAsync({ invite, selectedIds })
    } catch {
      // Mutation onError handles toasts (including overlap → force dialog).
    }
  }

  const addPlaceholder = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('reserved_crew').insert({
        time_period_id: timePeriodId,
        user_id: null,
        placeholder_name: name,
        placeholder_email: null,
        status: 'planned' as const,
        notes: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'time_periods', 'crew'],
      })
      success('Success', 'Placeholder crew member added')
      form.setFieldValue('placeholderName', '')
    },
    onError: (e: Error) => {
      toastError('Failed to add placeholder', e.message || 'Please try again.')
    },
  })

  const inviteByEmail = useMutation({
    mutationFn: async ({
      email,
      displayName,
    }: {
      email: string
      displayName: string
    }) => {
      await addMemberOrInvite({
        companyId,
        email,
        role: 'freelancer',
      })

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle()

      if (profErr) throw profErr

      const { error } = await supabase.from('reserved_crew').insert({
        time_period_id: timePeriodId,
        user_id: prof?.user_id ?? null,
        placeholder_name: prof?.user_id ? null : displayName,
        placeholder_email: prof?.user_id ? null : email,
        status: 'planned' as const,
        notes: null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'time_periods', 'crew'],
      })
      success(
        'Invite created',
        'They’ll get an email to join the company. The booking has been added to this role.',
      )
      form.setFieldValue('placeholderEmail', '')
      form.setFieldValue('placeholderName', '')
    },
    onError: (e: Error) => {
      toastError('Failed to invite', e.message || 'Please try again.')
    },
  })

  const handleAddPlaceholder = () => {
    const name = form.state.values.placeholderName.trim()
    if (!name) {
      toastError('Failed to add placeholder', 'Please enter a name')
      return
    }
    addPlaceholder.mutate(name)
  }

  const handleInvite = () => {
    const email = form.state.values.placeholderEmail.trim().toLowerCase()
    const displayName = form.state.values.placeholderName.trim() || email
    if (!email) {
      toastError('Failed to invite', 'Please enter an email')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toastError('Failed to invite', 'Please enter a valid email')
      return
    }
    inviteByEmail.mutate({ email, displayName })
  }

  return (
    <>
      <Dialog.Root open={open && !forceDialogOpen} onOpenChange={onOpenChange}>
        <Dialog.Content
          style={{
            maxWidth: 600,
            height: '60vh',
            maxHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Dialog.Title>Add Crew to Role</Dialog.Title>
          <Dialog.Description>
            Select people, then add them to the role or add and send an
            invitation. Invite is the usual action.
          </Dialog.Description>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (form.state.values.selectedIds.length === 0) return
              void runAddCrew({ invite: true })
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <form.AppForm>
              <Flex
                direction="column"
                style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
              >
                <Box my="4" style={{ flexShrink: 0 }}>
                  <form.AppField name="search">
                    {(field) => (
                      <TextField.Root
                        placeholder="Search by name or email…"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </form.AppField>
                  <Flex gap="2" mt="2" width="100%">
                    <Button
                      type="button"
                      size="2"
                      variant={
                        expandedPanel === 'placeholder' ? 'solid' : 'soft'
                      }
                      highContrast={expandedPanel === 'placeholder'}
                      onClick={() =>
                        setExpandedPanel((prev) =>
                          prev === 'placeholder' ? null : 'placeholder',
                        )
                      }
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <UserPlus width={16} height={16} />
                      Add placeholder
                    </Button>
                    <Button
                      type="button"
                      size="2"
                      variant={expandedPanel === 'invite' ? 'solid' : 'soft'}
                      highContrast={expandedPanel === 'invite'}
                      onClick={() =>
                        setExpandedPanel((prev) =>
                          prev === 'invite' ? null : 'invite',
                        )
                      }
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Mail width={16} height={16} />
                      Invite by email
                    </Button>
                  </Flex>

                  {expandedPanel === 'placeholder' && (
                    <Box mt="3">
                      <Text as="div" size="1" color="gray" mb="2">
                        Add a named crew member without a user account
                      </Text>
                      <form.AppField name="placeholderName">
                        {(field) => (
                          <TextField.Root
                            placeholder="Placeholder name"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                        )}
                      </form.AppField>
                    </Box>
                  )}

                  {expandedPanel === 'invite' && (
                    <Box mt="3">
                      <Text as="div" size="1" color="gray" mb="2">
                        Adds them to the company (or creates a pending invite)
                        and sends an email to sign up if needed.
                      </Text>
                      <Flex gap="2">
                        <form.AppField name="placeholderName">
                          {(field) => (
                            <TextField.Root
                              placeholder="Name (optional)"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              style={{ flex: 1 }}
                            />
                          )}
                        </form.AppField>
                        <form.AppField name="placeholderEmail">
                          {(field) => (
                            <TextField.Root
                              placeholder="Email"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              style={{ flex: 1 }}
                            />
                          )}
                        </form.AppField>
                      </Flex>
                    </Box>
                  )}
                </Box>

                {!expandedPanel && (
                  <Box
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      border: '1px solid var(--gray-a6)',
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    <form.Subscribe
                      selector={(state: { values: typeof defaultValues }) =>
                        state.values.selectedIds
                      }
                    >
                      {(selectedIds: Array<UUID>) => (
                        <>
                          {suggested.length > 0 && (
                            <Text
                              as="div"
                              size="1"
                              color="gray"
                              weight="medium"
                              mb="1"
                            >
                              Last used for this customer
                            </Text>
                          )}
                          {suggested.map((p, idx) => (
                            <CrewPickerPersonRow
                              key={p.user_id}
                              person={p}
                              internalNote={internalNotesByUserId[p.user_id]}
                              isSelected={selectedIds.includes(p.user_id)}
                              onToggle={toggleSelection}
                              showSeparator={
                                idx < suggested.length - 1 ||
                                rest.length > 0 ||
                                isFetching
                              }
                            />
                          ))}
                          {suggested.length > 0 && rest.length > 0 && (
                            <Text
                              as="div"
                              size="1"
                              color="gray"
                              weight="medium"
                              mt="2"
                              mb="1"
                            >
                              All crew
                            </Text>
                          )}
                          {isFetching && (
                            <Text size="2" color="gray">
                              Searching…
                            </Text>
                          )}
                          {!isFetching &&
                            suggested.length === 0 &&
                            rest.length === 0 && (
                              <Text size="2" color="gray">
                                No crew members found
                              </Text>
                            )}
                          {!isFetching &&
                            rest.map((p, idx) => (
                              <CrewPickerPersonRow
                                key={p.user_id}
                                person={p}
                                internalNote={internalNotesByUserId[p.user_id]}
                                isSelected={selectedIds.includes(p.user_id)}
                                onToggle={toggleSelection}
                                showSeparator={idx < rest.length - 1}
                              />
                            ))}
                        </>
                      )}
                    </form.Subscribe>
                  </Box>
                )}

                <form.Subscribe
                  selector={(state: { values: typeof defaultValues }) =>
                    state.values.selectedIds
                  }
                >
                  {(selectedIds: Array<UUID>) => (
                    <Flex
                      pt="4"
                      gap="2"
                      justify="end"
                      wrap="wrap"
                      style={{ flexShrink: 0, marginTop: 'auto' }}
                    >
                      <Dialog.Close>
                        <Button type="button" variant="soft">
                          Cancel
                        </Button>
                      </Dialog.Close>
                      {expandedPanel === 'placeholder' && (
                        <Button
                          type="button"
                          variant="solid"
                          onClick={handleAddPlaceholder}
                          disabled={
                            addPlaceholder.isPending || !placeholderName.trim()
                          }
                        >
                          {addPlaceholder.isPending ? 'Adding…' : 'Add'}
                        </Button>
                      )}
                      {expandedPanel === 'invite' && (
                        <Button
                          type="button"
                          variant="solid"
                          onClick={handleInvite}
                          disabled={
                            inviteByEmail.isPending || !placeholderEmail.trim()
                          }
                        >
                          {inviteByEmail.isPending ? 'Inviting…' : 'Invite'}
                        </Button>
                      )}
                      {!expandedPanel && (
                        <>
                          <Button
                            type="button"
                            variant="soft"
                            disabled={
                              save.isPending || selectedIds.length === 0
                            }
                            onClick={() => void runAddCrew({ invite: false })}
                          >
                            {save.isPending && !pendingInvite
                              ? 'Adding…'
                              : addCrewActionLabels(selectedIds.length).add}
                          </Button>
                          <Button
                            type="button"
                            variant="solid"
                            disabled={
                              save.isPending || selectedIds.length === 0
                            }
                            onClick={() => void runAddCrew({ invite: true })}
                          >
                            <Mail width={16} height={16} />
                            {save.isPending && pendingInvite
                              ? 'Inviting…'
                              : addCrewActionLabels(selectedIds.length)
                                  .addAndInvite}
                          </Button>
                        </>
                      )}
                    </Flex>
                  )}
                </form.Subscribe>
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
        onConfirm={() =>
          save.mutate({
            force: true,
            invite: pendingInvite,
            selectedIds: [...form.state.values.selectedIds],
          })
        }
      />
    </>
  )
}

function CrewPickerPersonRow({
  person,
  internalNote,
  isSelected,
  onToggle,
  showSeparator,
}: {
  person: CrewPickerPerson
  internalNote?: string
  isSelected: boolean
  onToggle: (userId: UUID) => void
  showSeparator: boolean
}) {
  return (
    <>
      <Box
        p="2"
        style={{
          cursor: 'pointer',
          borderRadius: 6,
          background: isSelected ? 'var(--blue-a3)' : 'transparent',
        }}
        onClick={() => onToggle(person.user_id)}
      >
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            {isSelected && (
              <Check
                width={18}
                height={18}
                style={{ color: 'var(--blue-11)' }}
              />
            )}
            <div>
              <Text weight="medium">{person.display_name ?? person.email}</Text>
              {person.display_name && (
                <Text size="1" color="gray" style={{ marginLeft: 6 }}>
                  {person.email}
                </Text>
              )}
              {internalNote && (
                <Text as="div" size="1" color="gray" mt="1">
                  <Text weight="medium">Internal:</Text> {internalNote}
                </Text>
              )}
            </div>
          </Flex>
          {isSelected && (
            <Text size="1" color="blue">
              Selected
            </Text>
          )}
        </Flex>
      </Box>
      {showSeparator && <Separator my="2" />}
    </>
  )
}
