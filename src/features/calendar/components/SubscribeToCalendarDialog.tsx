import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  ScrollArea,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Copy } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  getCalendarSubscription,
  upsertCalendarSubscription,
  getCalendarFeedUrl,
  type CalendarSubscriptionCategory,
  type CalendarSubscriptionPreferences,
} from '../api/calendarSubscription'
import { vehiclesIndexQuery } from '@features/vehicles/api/queries'

const CATEGORY_OPTIONS: { value: CalendarSubscriptionCategory; label: string; description: string }[] = [
  {
    value: 'program',
    label: 'Jobs / program',
    description: 'Job duration and program time blocks (e.g. setup, rehearsals).',
  },
  {
    value: 'equipment',
    label: 'Equipment',
    description: 'Equipment reservations and bookings.',
  },
  {
    value: 'crew',
    label: 'Crew',
    description: 'Crew assignments and who is booked on which periods.',
  },
  {
    value: 'transport',
    label: 'Transport',
    description: 'Vehicle bookings and transport reservations.',
  },
]

export default function SubscribeToCalendarDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { companyId } = useCompany()
  const { userId } = useAuthz()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const [categories, setCategories] = React.useState<Set<CalendarSubscriptionCategory>>(
    new Set(['program']),
  )
  const [onlyMyCrewAssignments, setOnlyMyCrewAssignments] = React.useState(false)
  const [includeProjectLeadJobs, setIncludeProjectLeadJobs] = React.useState(false)
  const [vehicleIds, setVehicleIds] = React.useState<Set<string>>(new Set())
  const [savedToken, setSavedToken] = React.useState<string | null>(null)

  const { data: subscription } = useQuery({
    queryKey: ['calendar-subscription', companyId ?? '', userId ?? ''],
    queryFn: () =>
      getCalendarSubscription(companyId!, userId!),
    enabled: open && !!companyId && !!userId,
  })

  const { data: vehicles = [] } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '',
      includeExternal: true,
      search: '',
    }),
    enabled: open && !!companyId && categories.has('transport'),
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId) throw new Error('Not signed in')
      return upsertCalendarSubscription(companyId, userId, {
        categories: Array.from(categories),
        onlyMyAssignments: onlyMyCrewAssignments,
        includeProjectLeadJobs,
        vehicleIds: vehicleIds.size > 0 ? Array.from(vehicleIds) : null,
      })
    },
    onSuccess: (data) => {
      setSavedToken(data.token)
      qc.invalidateQueries({ queryKey: ['calendar-subscription', companyId, userId] })
      success('Calendar link ready', 'Copy the link below to add this calendar to your phone.')
    },
    onError: (err: Error) => {
      toastError('Failed to save', err.message)
    },
  })

  React.useEffect(() => {
    if (subscription) {
      setCategories(
        new Set(
          (subscription.categories || ['program']) as CalendarSubscriptionCategory[],
        ),
      )
      setOnlyMyCrewAssignments(!!subscription.only_my_assignments)
      setIncludeProjectLeadJobs(!!subscription.include_project_lead_jobs)
      setVehicleIds(
        new Set((subscription.vehicle_ids || []).filter(Boolean)),
      )
      setSavedToken(subscription.token)
    } else if (!open) {
      setSavedToken(null)
    }
  }, [subscription, open])

  const feedUrl = savedToken ? getCalendarFeedUrl(savedToken) : ''
  const handleCopy = () => {
    if (!feedUrl) return
    navigator.clipboard.writeText(feedUrl).then(
      () => success('Copied', 'Calendar link copied to clipboard.'),
      () => toastError('Copy failed', 'Could not copy to clipboard.'),
    )
  }

  const toggleCategory = (value: CalendarSubscriptionCategory) => {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const toggleVehicle = (id: string) => {
    setVehicleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Subscribe to calendar</Dialog.Title>
        <Text size="2" color="gray" as="p" mt="1">
          Add this calendar to your phone (iPhone or Android). Choose what to include below; only Jobs are included by default.
        </Text>

        <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: '60vh' }}>
          <Flex direction="column" gap="4" mt="4">
            <Box>
              <Text size="2" weight="medium" as="p" mb="2">
                What to include
              </Text>
              <Flex direction="column" gap="3">
                {CATEGORY_OPTIONS.map((opt) => (
                  <Box key={opt.value}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-2)',
                        cursor: 'pointer',
                      }}
                    >
                      <Checkbox
                        checked={categories.has(opt.value)}
                        onCheckedChange={() => toggleCategory(opt.value)}
                        style={{ marginTop: 2 }}
                      />
                      <Box>
                        <Text size="2" weight="medium">
                          {opt.label}
                        </Text>
                        <Text size="1" color="gray" as="p" mt="0" mb="0">
                          {opt.description}
                        </Text>
                      </Box>
                    </label>
                  </Box>
                ))}
              </Flex>
            </Box>

            {categories.has('program') && (
              <Box>
                <Text size="2" weight="medium" as="p" mb="2">
                  Jobs filter
                </Text>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    cursor: 'pointer',
                  }}
                >
                  <Checkbox
                    checked={includeProjectLeadJobs}
                    onCheckedChange={(checked) => setIncludeProjectLeadJobs(checked === true)}
                  />
                  <Box>
                    <Text size="2">Only jobs where I am project lead</Text>
                    <Text size="1" color="gray" as="p" mt="0">
                      Include only program events for jobs you lead.
                    </Text>
                  </Box>
                </label>
              </Box>
            )}

            {categories.has('crew') && (
              <Box>
                <Text size="2" weight="medium" as="p" mb="2">
                  Crew filter
                </Text>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    cursor: 'pointer',
                  }}
                >
                  <Checkbox
                    checked={onlyMyCrewAssignments}
                    onCheckedChange={(checked) => setOnlyMyCrewAssignments(checked === true)}
                  />
                  <Box>
                    <Text size="2">Only my crew assignments</Text>
                    <Text size="1" color="gray" as="p" mt="0">
                      Include only periods where you are booked as crew.
                    </Text>
                  </Box>
                </label>
              </Box>
            )}

            {categories.has('transport') && vehicles.length > 0 && (
              <Box>
                <Text size="2" weight="medium" as="p" mb="2">
                  Which vehicles to include
                </Text>
                <Text size="1" color="gray" as="p" mt="0" mb="2">
                  Leave all unchecked to include all vehicle bookings. Check specific vehicles to include only their bookings.
                </Text>
                <Box
                  style={{
                    border: '1px solid var(--gray-a6)',
                    borderRadius: 'var(--radius-2)',
                    padding: 'var(--space-2)',
                    maxHeight: 180,
                    overflowY: 'auto',
                  }}
                >
                  <Flex direction="column" gap="1">
                    {vehicles.map((v) => (
                      <label
                        key={v.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          cursor: 'pointer',
                        }}
                      >
                        <Checkbox
                          checked={vehicleIds.has(v.id)}
                          onCheckedChange={() => toggleVehicle(v.id)}
                        />
                        <Text size="2">
                          {v.name}
                          {v.registration_no ? ` (${v.registration_no})` : ''}
                        </Text>
                      </label>
                    ))}
                  </Flex>
                </Box>
              </Box>
            )}

            {feedUrl && (
              <Box mt="2">
                <Text size="2" weight="medium" as="p" mb="2">
                  Calendar link
                </Text>
                <Flex gap="2" align="center">
                  <TextField.Root
                    value={feedUrl}
                    readOnly
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                  />
                  <Button variant="soft" size="2" onClick={handleCopy}>
                    <Copy /> Copy
                  </Button>
                </Flex>
                <Text size="1" color="gray" as="p" mt="2">
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
          </Flex>
        </ScrollArea>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            variant="classic"
          >
            {savedToken ? 'Update & show link' : 'Save & get link'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
