import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  Flex,
  RadioCards,
  Switch,
  Text,
  TextField,
} from '@radix-ui/themes'
import {
  Calendar,
  Car,
  Copy,
  Group,
  Leaderboard,
  NavArrowDown,
  NavArrowRight,
  Trash,
  Truck,
  User,
} from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { vehiclesIndexQuery } from '@features/vehicles/api/queries'
import { crewIndexQuery } from '@features/crew/api/queries'
import { canFollowCrewUser, crewDisplayName } from '../utils/canFollowCrewUser'
import {
  createCalendarSubscription,
  deleteCalendarSubscription,
  getCalendarFeedUrl,
  getCalendarSubscriptions,
  updateCalendarSubscription,
} from '../api/calendarSubscription'
import type {
  CalendarSubscriptionKind,
  CalendarSubscriptionRow,
} from '../api/calendarSubscription'

// Order: transport_vehicle last so it appears alone on the last row when in a 2-col grid
const PREMADE_OPTIONS: Array<{
  kind: CalendarSubscriptionKind
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}> = [
  {
    kind: 'all_jobs',
    label: 'All jobs in the company',
    description:
      'Job duration periods with job title, project lead, customer and location.',
    Icon: Calendar,
  },
  {
    kind: 'project_lead_jobs',
    label: 'Jobs where I am project lead',
    description:
      'Same as above, events start with "PROJECT LEAD". Optional 1-hour reminder before the job starts.',
    Icon: Leaderboard,
  },
  {
    kind: 'crew_jobs',
    label: 'Jobs where I am crew',
    description:
      'Confirmed crew bookings and pending invitations. Pending items are labelled PENDING INVITATION.',
    Icon: Group,
  },
  {
    kind: 'crew_user',
    label: 'Crew: one person',
    description:
      'Pick a company member. Events start with CREW and their name. Includes their personal holds.',
    Icon: User,
  },
  {
    kind: 'transport_all',
    label: 'All transport vehicles',
    description: 'All vehicles. Events start with vehicle name and reg.no.',
    Icon: Truck,
  },
  {
    kind: 'transport_vehicle',
    label: 'Transport: one vehicle',
    description:
      'Pick a vehicle. Events show job title, customer and project lead.',
    Icon: Car,
  },
]

const PICKER_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-2)',
  width: '100%',
}

function crewAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

const KIND_LABELS: Record<CalendarSubscriptionKind, string> = {
  all_jobs: 'All jobs in company',
  project_lead_jobs: 'My project lead jobs',
  crew_jobs: 'My crew jobs',
  crew_user: 'Crew (one person)',
  transport_vehicle: 'Transport (one vehicle)',
  transport_all: 'All transport vehicles',
}

export default function SubscribeToCalendarDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const isFreelancer = companyRole === 'freelancer'

  const [addKind, setAddKind] = React.useState<CalendarSubscriptionKind | null>(
    null,
  )
  const [addVehicleId, setAddVehicleId] = React.useState<string | null>(null)
  const [addCrewUserId, setAddCrewUserId] = React.useState<string | null>(null)
  const [addRemind1h, setAddRemind1h] = React.useState(true)
  const [instructionsOpen, setInstructionsOpen] = React.useState(false)

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['calendar-subscriptions', companyId ?? '', userId ?? ''],
    queryFn: () => getCalendarSubscriptions(companyId!, userId!),
    enabled: open && !!companyId && !!userId,
  })

  const { data: vehicles = [] } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '',
      includeExternal: true,
      search: '',
    }),
    enabled: open && !!companyId && addKind === 'transport_vehicle',
  })

  const { data: crewPeople = [] } = useQuery({
    ...crewIndexQuery({
      companyId: companyId ?? '',
      kind: 'all',
    }),
    enabled: open && !!companyId && !isFreelancer,
  })

  const createMutation = useMutation({
    mutationFn: async (params: {
      kind: CalendarSubscriptionKind
      vehicleId?: string | null
      crewUserId?: string | null
      remind1hBefore?: boolean
    }) => {
      if (!companyId || !userId) throw new Error('Not signed in')
      return createCalendarSubscription(companyId, userId, params)
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['calendar-subscriptions', companyId, userId],
      })
      success(
        'Calendar added',
        'Copy the link below to add this calendar to your device.',
      )
      setAddKind(null)
      setAddVehicleId(null)
      setAddCrewUserId(null)
      setAddRemind1h(true)
    },
    onError: (err: Error) => {
      toastError('Failed to add calendar', err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCalendarSubscription(id, userId!),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['calendar-subscriptions', companyId, userId],
      })
      success('Calendar removed', 'That subscription has been removed.')
    },
    onError: (err: Error) => {
      toastError('Failed to remove', err.message)
    },
  })

  const reminderMutation = useMutation({
    mutationFn: (params: { id: string; remind1hBefore: boolean }) =>
      updateCalendarSubscription(params.id, userId!, {
        remind1hBefore: params.remind1hBefore,
      }),
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({
        queryKey: ['calendar-subscriptions', companyId, userId],
      })
      success(
        vars.remind1hBefore ? 'Reminder on' : 'Reminder off',
        vars.remind1hBefore
          ? 'Your calendar will alert you 1 hour before jobs you lead.'
          : 'The 1-hour reminder was removed. Refresh the calendar on your device.',
      )
    },
    onError: (err: Error) => {
      toastError('Failed to update reminder', err.message)
    },
  })

  const handleCopy = (token: string) => {
    const url = getCalendarFeedUrl(token)
    navigator.clipboard.writeText(url).then(
      () => success('Copied', 'Calendar link copied to clipboard.'),
      () => toastError('Copy failed', 'Could not copy to clipboard.'),
    )
  }

  const handleAdd = () => {
    if (!addKind) return
    if (addKind === 'transport_vehicle' && !addVehicleId) {
      toastError('Pick a vehicle', 'Select a vehicle for this calendar.')
      return
    }
    if (addKind === 'crew_user' && !addCrewUserId) {
      toastError('Pick a person', 'Select whose crew calendar to follow.')
      return
    }
    createMutation.mutate({
      kind: addKind,
      vehicleId: addKind === 'transport_vehicle' ? addVehicleId : undefined,
      crewUserId: addKind === 'crew_user' ? addCrewUserId : undefined,
      remind1hBefore: addKind === 'project_lead_jobs' ? addRemind1h : false,
    })
  }

  const optionsToShow = isFreelancer
    ? PREMADE_OPTIONS.filter((o) => o.kind === 'crew_jobs')
    : PREMADE_OPTIONS

  const canAddMore = subscriptions.length < 10

  const getSubscriptionLabel = (row: CalendarSubscriptionRow): string => {
    if (
      row.kind === 'transport_vehicle' &&
      row.vehicle_id &&
      vehicles.length > 0
    ) {
      const v = vehicles.find((x) => x.id === row.vehicle_id)
      return v
        ? `Transport: ${v.name}${v.registration_no ? ` (${v.registration_no})` : ''}`
        : KIND_LABELS[row.kind]
    }
    if (row.kind === 'crew_user' && row.crew_user_id) {
      const person = crewPeople.find((p) => p.user_id === row.crew_user_id)
      return person ? `Crew: ${crewDisplayName(person)}` : KIND_LABELS[row.kind]
    }
    return KIND_LABELS[row.kind]
  }

  const followableCrew = React.useMemo(() => {
    if (!userId || !companyRole) return []
    return crewPeople.filter((p) =>
      canFollowCrewUser({
        subscriberUserId: userId,
        subscriberRole: companyRole,
        targetUserId: p.user_id,
        targetRole: p.role,
      }),
    )
  }, [crewPeople, userId, companyRole])

  const alreadyFollowedCrewIds = React.useMemo(
    () =>
      new Set(
        subscriptions
          .filter((s) => s.kind === 'crew_user' && s.crew_user_id)
          .map((s) => s.crew_user_id as string),
      ),
    [subscriptions],
  )

  // Disable option if user already has a subscription of that kind (transport_vehicle and crew_user can have multiple)
  const isOptionDisabled = (kind: CalendarSubscriptionKind) =>
    kind !== 'transport_vehicle' &&
    kind !== 'crew_user' &&
    subscriptions.some((s) => s.kind === kind)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="540px">
        <Dialog.Title>Subscribe to calendar</Dialog.Title>
        <Dialog.Description size="2" color="gray" mt="1">
          Add calendar feeds to your phone or computer. You can have up to 10
          subscriptions. Choose a type below and copy the link.
        </Dialog.Description>

        <Box mt="4">
          <Text size="2" weight="medium" as="p" mb="2">
            Your calendar subscriptions ({subscriptions.length}/10)
          </Text>
          {isLoading ? (
            <Text size="2" color="gray">
              Loading…
            </Text>
          ) : subscriptions.length === 0 ? (
            <Text size="2" color="gray">
              No subscriptions yet. Add one below.
            </Text>
          ) : (
            <Flex direction="column" gap="2">
              {subscriptions.map((sub) => (
                <Box
                  key={sub.id}
                  style={{
                    border: '1px solid var(--gray-a6)',
                    borderRadius: 'var(--radius-2)',
                    padding: 'var(--space-3)',
                  }}
                >
                  <Flex justify="between" align="center" gap="2">
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="2" weight="medium" as="p">
                        {getSubscriptionLabel(sub)}
                      </Text>
                      <TextField.Root
                        size="1"
                        value={getCalendarFeedUrl(sub.token)}
                        readOnly
                        style={{
                          marginTop: 'var(--space-1)',
                          fontFamily: 'monospace',
                          fontSize: 'var(--font-size-1)',
                        }}
                      />
                    </Box>
                    <Flex gap="2" style={{ flexShrink: 0 }}>
                      <Button
                        variant="soft"
                        size="2"
                        onClick={() => handleCopy(sub.token)}
                        title="Copy link"
                      >
                        <Copy />
                      </Button>
                      <Button
                        variant="soft"
                        color="red"
                        size="2"
                        onClick={() => deleteMutation.mutate(sub.id)}
                        disabled={deleteMutation.isPending}
                        title="Remove subscription"
                      >
                        <Trash />
                      </Button>
                    </Flex>
                  </Flex>
                  {sub.kind === 'project_lead_jobs' && (
                    <Flex align="center" justify="between" gap="3" mt="2">
                      <Text size="1" color="gray">
                        Remind me 1 hour before the job starts
                      </Text>
                      <Switch
                        size="1"
                        checked={sub.remind_1h_before}
                        disabled={reminderMutation.isPending}
                        aria-label="Remind me 1 hour before the job starts"
                        onCheckedChange={(checked) =>
                          reminderMutation.mutate({
                            id: sub.id,
                            remind1hBefore: checked === true,
                          })
                        }
                      />
                    </Flex>
                  )}
                </Box>
              ))}
            </Flex>
          )}

          <Flex direction="column" gap="4" mt="4">
            {/* Add new subscription */}
            {canAddMore && (
              <Box>
                <Text size="2" weight="medium" as="p" mb="2">
                  Add a calendar
                </Text>
                <RadioCards.Root
                  value={addKind ?? ''}
                  onValueChange={(val) => {
                    const k = val as CalendarSubscriptionKind
                    setAddKind(k)
                    if (k !== 'transport_vehicle') setAddVehicleId(null)
                    if (k !== 'crew_user') setAddCrewUserId(null)
                    if (k === 'project_lead_jobs') setAddRemind1h(true)
                  }}
                >
                  <Box
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--space-3)',
                      width: '100%',
                    }}
                  >
                    {optionsToShow.map((opt, index) => {
                      const isLastAndOdd =
                        optionsToShow.length % 2 === 1 &&
                        index === optionsToShow.length - 1
                      const IconComponent = opt.Icon
                      return (
                        <Box
                          key={opt.kind}
                          style={
                            isLastAndOdd
                              ? {
                                  gridColumn: '1 / -1',
                                  width: '100%',
                                  minWidth: 0,
                                }
                              : undefined
                          }
                        >
                          <RadioCards.Item
                            value={opt.kind}
                            disabled={isOptionDisabled(opt.kind)}
                            style={isLastAndOdd ? { width: '100%' } : undefined}
                          >
                            <Box>
                              <Flex gap="2" align="center" mb="1">
                                <IconComponent
                                  style={{
                                    width: 20,
                                    height: 20,
                                    flexShrink: 0,
                                  }}
                                />
                                <Text size="2" weight="medium">
                                  {opt.label}
                                </Text>
                              </Flex>
                              <Text size="1" color="gray" as="p" mt="0" mb="0">
                                {opt.description}
                              </Text>
                            </Box>
                          </RadioCards.Item>
                        </Box>
                      )
                    })}
                  </Box>
                </RadioCards.Root>

                {addKind === 'transport_vehicle' && vehicles.length > 0 && (
                  <Box mt="4">
                    <Text size="2" weight="medium" as="p" mb="2">
                      Choose vehicle
                    </Text>
                    <RadioCards.Root
                      value={addVehicleId ?? ''}
                      onValueChange={(val) => setAddVehicleId(val)}
                    >
                      <Box style={PICKER_GRID_STYLE}>
                        {vehicles.map((v, index) => {
                          const isLastAndOdd =
                            vehicles.length % 2 === 1 &&
                            index === vehicles.length - 1
                          return (
                            <Box
                              key={v.id}
                              style={
                                isLastAndOdd
                                  ? {
                                      gridColumn: '1 / -1',
                                      width: '100%',
                                      minWidth: 0,
                                    }
                                  : undefined
                              }
                            >
                              <RadioCards.Item
                                value={v.id}
                                style={
                                  isLastAndOdd ? { width: '100%' } : undefined
                                }
                              >
                                <Flex gap="2" align="center">
                                  <Car
                                    style={{
                                      width: 18,
                                      height: 18,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Text size="2">
                                    {v.name}
                                    {v.registration_no
                                      ? ` (${v.registration_no})`
                                      : ''}
                                  </Text>
                                </Flex>
                              </RadioCards.Item>
                            </Box>
                          )
                        })}
                      </Box>
                    </RadioCards.Root>
                  </Box>
                )}

                {addKind === 'crew_user' && (
                  <Box mt="4">
                    <Text size="2" weight="medium" as="p" mb="2">
                      Choose person
                    </Text>
                    {followableCrew.length === 0 ? (
                      <Text size="2" color="gray">
                        No other company members to follow.
                      </Text>
                    ) : (
                      <RadioCards.Root
                        value={addCrewUserId ?? ''}
                        onValueChange={(val) => setAddCrewUserId(val)}
                      >
                        <Box style={PICKER_GRID_STYLE}>
                          {followableCrew.map((person, index) => {
                            const isLastAndOdd =
                              followableCrew.length % 2 === 1 &&
                              index === followableCrew.length - 1
                            const already = alreadyFollowedCrewIds.has(
                              person.user_id,
                            )
                            const name = crewDisplayName(person)
                            return (
                              <Box
                                key={person.user_id}
                                style={
                                  isLastAndOdd
                                    ? {
                                        gridColumn: '1 / -1',
                                        width: '100%',
                                        minWidth: 0,
                                      }
                                    : undefined
                                }
                              >
                                <RadioCards.Item
                                  value={person.user_id}
                                  disabled={already}
                                  style={
                                    isLastAndOdd ? { width: '100%' } : undefined
                                  }
                                >
                                  <Flex
                                    gap="2"
                                    align="center"
                                    style={{ minWidth: 0 }}
                                  >
                                    <Avatar
                                      size="2"
                                      radius="full"
                                      src={
                                        crewAvatarUrl(person.avatar_url) ??
                                        undefined
                                      }
                                      fallback={getInitials(name)}
                                      style={{ flexShrink: 0 }}
                                    />
                                    <Text
                                      size="2"
                                      style={{
                                        minWidth: 0,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {name}
                                      {already ? ' (added)' : ''}
                                    </Text>
                                  </Flex>
                                </RadioCards.Item>
                              </Box>
                            )
                          })}
                        </Box>
                      </RadioCards.Root>
                    )}
                  </Box>
                )}

                {addKind === 'project_lead_jobs' &&
                  !isOptionDisabled(addKind) && (
                    <Flex align="center" justify="between" gap="3" mt="3">
                      <Box>
                        <Text size="2">
                          Remind me 1 hour before the job starts
                        </Text>
                        <Text size="1" color="gray" as="p" mt="1" mb="0">
                          Calendar alert on this feed only — not on jobs you do
                          not lead.
                        </Text>
                      </Box>
                      <Switch
                        checked={addRemind1h}
                        aria-label="Remind me 1 hour before the job starts"
                        onCheckedChange={(checked) =>
                          setAddRemind1h(checked === true)
                        }
                      />
                    </Flex>
                  )}

                {addKind && !isOptionDisabled(addKind) && (
                  <Flex gap="2" mt="3" align="center">
                    <Button
                      size="2"
                      onClick={handleAdd}
                      disabled={
                        createMutation.isPending ||
                        (addKind === 'transport_vehicle' && !addVehicleId) ||
                        (addKind === 'crew_user' && !addCrewUserId)
                      }
                    >
                      Add this calendar
                    </Button>
                    <Button
                      variant="soft"
                      size="2"
                      onClick={() => {
                        setAddKind(null)
                        setAddVehicleId(null)
                        setAddCrewUserId(null)
                        setAddRemind1h(true)
                      }}
                    >
                      Cancel
                    </Button>
                  </Flex>
                )}
              </Box>
            )}

            <Box mt="2">
              <Flex
                align="center"
                gap="2"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setInstructionsOpen((o) => !o)}
              >
                {instructionsOpen ? (
                  <NavArrowDown width={16} height={16} />
                ) : (
                  <NavArrowRight width={16} height={16} />
                )}
                <Text size="1" color="gray" weight="medium">
                  How to add the calendar
                </Text>
              </Flex>
              {instructionsOpen && (
                <Box pl="5" mt="2">
                  <Text size="1" color="gray" as="p">
                    <strong>Mac:</strong> Open Calendar → File → New Calendar
                    Subscription… → paste the link → Subscribe.
                  </Text>
                  <Text size="1" color="gray" as="p" mt="1">
                    <strong>iPhone:</strong> Settings → Calendar → Accounts →
                    Add Account → Other → Add Subscribed Calendar → paste the
                    link.
                  </Text>
                  <Text size="1" color="gray" as="p" mt="1">
                    <strong>Android:</strong> Google Calendar → Settings → Add
                    account → Subscribe to calendar → paste the link.
                  </Text>
                  <Text size="1" color="gray" as="p" mt="1">
                    The calendar may take up to an hour to refresh on your
                    device.
                  </Text>
                </Box>
              )}
            </Box>
          </Flex>
        </Box>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
