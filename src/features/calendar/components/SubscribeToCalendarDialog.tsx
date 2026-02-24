import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  RadioCards,
  ScrollArea,
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
} from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  getCalendarSubscriptions,
  createCalendarSubscription,
  deleteCalendarSubscription,
  getCalendarFeedUrl,
  type CalendarSubscriptionKind,
  type CalendarSubscriptionRow,
} from '../api/calendarSubscription'
import { vehiclesIndexQuery } from '@features/vehicles/api/queries'

// Order: transport_vehicle last so it appears alone on the last row when in a 2-col grid
const PREMADE_OPTIONS: {
  kind: CalendarSubscriptionKind
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}[] = [
  {
    kind: 'all_jobs',
    label: 'All jobs in the company',
    description: 'Job duration periods with job title, project lead, customer and location.',
    Icon: Calendar,
  },
  {
    kind: 'project_lead_jobs',
    label: 'Jobs where I am project lead',
    description: 'Same as above, events start with "PROJECT LEAD".',
    Icon: Leaderboard,
  },
  {
    kind: 'crew_jobs',
    label: 'Jobs where I am crew',
    description: 'Jobs you are assigned to as crew; events start with "CREW".',
    Icon: Group,
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
    description: 'Pick a vehicle. Events show job title, customer and project lead.',
    Icon: Car,
  },
]

const KIND_LABELS: Record<CalendarSubscriptionKind, string> = {
  all_jobs: 'All jobs in company',
  project_lead_jobs: 'My project lead jobs',
  crew_jobs: 'My crew jobs',
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

  const [addKind, setAddKind] = React.useState<CalendarSubscriptionKind | null>(null)
  const [addVehicleId, setAddVehicleId] = React.useState<string | null>(null)
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

  const createMutation = useMutation({
    mutationFn: async (params: { kind: CalendarSubscriptionKind; vehicleId?: string | null }) => {
      if (!companyId || !userId) throw new Error('Not signed in')
      return createCalendarSubscription(companyId, userId, params)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-subscriptions', companyId, userId] })
      success('Calendar added', 'Copy the link below to add this calendar to your device.')
      setAddKind(null)
      setAddVehicleId(null)
    },
    onError: (err: Error) => {
      toastError('Failed to add calendar', err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCalendarSubscription(id, userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-subscriptions', companyId, userId] })
      success('Calendar removed', 'That subscription has been removed.')
    },
    onError: (err: Error) => {
      toastError('Failed to remove', err.message)
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
    createMutation.mutate({
      kind: addKind,
      vehicleId: addKind === 'transport_vehicle' ? addVehicleId : undefined,
    })
  }

  const optionsToShow = isFreelancer
    ? PREMADE_OPTIONS.filter((o) => o.kind === 'crew_jobs')
    : PREMADE_OPTIONS

  const canAddMore = subscriptions.length < 10

  const getSubscriptionLabel = (row: CalendarSubscriptionRow): string => {
    if (row.kind === 'transport_vehicle' && row.vehicle_id && vehicles.length > 0) {
      const v = vehicles.find((x) => x.id === row.vehicle_id)
      return v ? `Transport: ${v.name}${v.registration_no ? ` (${v.registration_no})` : ''}` : KIND_LABELS[row.kind]
    }
    return KIND_LABELS[row.kind as CalendarSubscriptionKind]
  }

  // Disable option if user already has a subscription of that kind (transport_vehicle can have multiple)
  const isOptionDisabled = (kind: CalendarSubscriptionKind) =>
    kind !== 'transport_vehicle' && subscriptions.some((s) => s.kind === kind)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="540px">
        <Dialog.Title>Subscribe to calendar</Dialog.Title>
        <Text size="2" color="gray" as="p" mt="1">
          Add calendar feeds to your phone or computer. You can have up to 10 subscriptions. Choose a type below and copy the link.
        </Text>

        {/* Your calendar subscriptions – always visible, not inside scroll */}
        <Box mt="4">
          <Text size="2" weight="medium" as="p" mb="2">
            Your calendar subscriptions ({subscriptions.length}/10)
          </Text>
          {isLoading ? (
            <Text size="2" color="gray">Loading…</Text>
          ) : subscriptions.length === 0 ? (
            <Text size="2" color="gray">No subscriptions yet. Add one below.</Text>
          ) : (
            <Flex direction="column" gap="2" style={{ maxHeight: 220, overflowY: 'auto' }}>
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
                          fontSize: 11,
                        }}
                      />
                    </Box>
                    <Flex gap="2" shrink="0">
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
                </Box>
              ))}
            </Flex>
          )}
        </Box>

        <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: '50vh' }}>
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
                        optionsToShow.length % 2 === 1 && index === optionsToShow.length - 1
                      const IconComponent = opt.Icon
                      return (
                        <Box
                          key={opt.kind}
                          style={
                            isLastAndOdd
                              ? { gridColumn: '1 / -1', width: '100%', minWidth: 0 }
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
                                  style={{ width: 20, height: 20, flexShrink: 0 }}
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
                      <Box
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 'var(--space-2)',
                          maxHeight: 200,
                          overflowY: 'auto',
                          width: '100%',
                        }}
                      >
                        {vehicles.map((v, index) => {
                          const isLastAndOdd =
                            vehicles.length % 2 === 1 && index === vehicles.length - 1
                          return (
                            <Box
                              key={v.id}
                              style={
                                isLastAndOdd
                                  ? { gridColumn: '1 / -1', width: '100%', minWidth: 0 }
                                  : undefined
                              }
                            >
                              <RadioCards.Item
                                value={v.id}
                                style={isLastAndOdd ? { width: '100%' } : undefined}
                              >
                                <Flex gap="2" align="center">
                                  <Car
                                    style={{ width: 18, height: 18, flexShrink: 0 }}
                                  />
                                  <Text size="2">
                                    {v.name}
                                    {v.registration_no ? ` (${v.registration_no})` : ''}
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

                {addKind && !isOptionDisabled(addKind) && (
                  <Flex gap="2" mt="3" align="center">
                    <Button
                      size="2"
                      onClick={handleAdd}
                      disabled={
                        createMutation.isPending ||
                        (addKind === 'transport_vehicle' && !addVehicleId)
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
                    <strong>Mac:</strong> Open Calendar → File → New Calendar Subscription… → paste the link → Subscribe.
                  </Text>
                  <Text size="1" color="gray" as="p" mt="1">
                    <strong>iPhone:</strong> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the link.
                  </Text>
                  <Text size="1" color="gray" as="p" mt="1">
                    <strong>Android:</strong> Google Calendar → Settings → Add account → Subscribe to calendar → paste the link.
                  </Text>
                  <Text size="1" color="gray" as="p" mt="1">
                    The calendar may take up to an hour to refresh on your device.
                  </Text>
                </Box>
              )}
            </Box>
          </Flex>
        </ScrollArea>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
