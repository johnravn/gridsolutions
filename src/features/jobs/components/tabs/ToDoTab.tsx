// src/features/jobs/components/tabs/ToDoTab.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { ArrowRight, CheckCircle, XmarkCircle } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@shared/api/supabase'
import ContactDialog from '../dialogs/ContactDialog'
import type { JobDetail } from '../../types'

type TodoItem = {
  id: string
  type:
    | 'missing_location'
    | 'missing_contact'
    | 'unassigned_crew'
    | 'unconfirmed_vehicle'
    | 'uninvoiced_completed'
    | 'no_crew_planned'
    | 'crew_planned_not_requested'
    | 'insufficient_crew_requested'
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, any>
}

export default function ToDoTab({
  jobId,
  job,
}: {
  jobId: string
  job: JobDetail
}) {
  const navigate = useNavigate()
  const [contactDialogOpen, setContactDialogOpen] = React.useState(false)

  // Fetch crew roles with needed_count and status breakdowns
  const { data: crewRoles } = useQuery({
    queryKey: ['jobs', jobId, 'todo', 'crew-roles'],
    queryFn: async () => {
      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, title, needed_count')
        .eq('job_id', jobId)
        .eq('category', 'crew')
        .eq('deleted', false)
      if (tpErr) throw tpErr

      if (timePeriods.length === 0) return []

      const tpIds = timePeriods.map((tp) => tp.id)
      const { data: assignments, error: assignErr } = await supabase
        .from('reserved_crew')
        .select('time_period_id, status')
        .in('time_period_id', tpIds)
      if (assignErr) throw assignErr

      // Count assignments by status for each time period
      const statusByTp = new Map<string, Record<string, number>>()
      for (const a of assignments) {
        const key = a.time_period_id
        const bag = statusByTp.get(key) || {}
        bag[a.status] = (bag[a.status] || 0) + 1
        statusByTp.set(key, bag)
      }

      return timePeriods.map((tp) => {
        const counts = statusByTp.get(tp.id) || {}
        return {
          id: tp.id,
          title: tp.title || 'Untitled Role',
          needed_count: tp.needed_count || 0,
          planned_count: counts['planned'] || 0,
          requested_count: counts['requested'] || 0,
          accepted_count: counts['accepted'] || 0,
          declined_count: counts['declined'] || 0,
          assigned_count:
            (counts['planned'] || 0) +
            (counts['requested'] || 0) +
            (counts['accepted'] || 0) +
            (counts['declined'] || 0),
        }
      })
    },
  })

  // Fetch vehicle bookings that might need confirmation
  const { data: vehicleBookings } = useQuery({
    queryKey: ['jobs', jobId, 'todo', 'vehicles'],
    queryFn: async () => {
      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
        .eq('category', 'transport')
        .eq('deleted', false)
      if (tpErr) throw tpErr

      if (timePeriods.length === 0) return []

      const tpIds = timePeriods.map((tp) => tp.id)
      const { data: bookings, error: bookErr } = await supabase
        .from('reserved_vehicles')
        .select(
          'id, vehicle_id, external_status, vehicle:vehicle_id ( id, name, internally_owned, external_owner_id, owner_user_id )',
        )
        .in('time_period_id', tpIds)
      if (bookErr) throw bookErr

      // Check for bookings that might need confirmation
      // External bookings with certain statuses, or internal bookings that might need confirmation
      return bookings.map((booking: any) => ({
        id: booking.id,
        vehicle_id: booking.vehicle_id,
        external_status: booking.external_status,
        vehicle: Array.isArray(booking.vehicle)
          ? booking.vehicle[0]
          : booking.vehicle,
        is_external: !!(Array.isArray(booking.vehicle)
          ? !booking.vehicle[0]?.internally_owned
          : !booking.vehicle?.internally_owned),
      }))
    },
  })

  // Generate todo items
  const todoItems = React.useMemo<Array<TodoItem>>(() => {
    const items: Array<TodoItem> = []

    // 1. Check for missing location
    if (!job.job_address_id) {
      items.push({
        id: 'missing-location',
        type: 'missing_location',
        title: 'Missing Location',
        description: 'No location has been set for this job.',
        severity: 'high',
        actionUrl: `/jobs?jobId=${jobId}&tab=overview`,
        actionLabel: 'Add Location',
      })
    }

    // 2. Check for missing contact
    if (!job.customer_contact_id && job.customer_id) {
      items.push({
        id: 'missing-contact',
        type: 'missing_contact',
        title: 'Missing Contact',
        description: 'No contact has been set for this job.',
        severity: 'high',
        actionUrl: `/jobs?jobId=${jobId}&tab=overview`,
        actionLabel: 'Add Contact',
      })
    }

    // 3. Check for crew role issues
    if (crewRoles) {
      crewRoles.forEach((role) => {
        const needed = role.needed_count || 0

        // Skip if no crew needed for this role
        if (needed === 0) return

        const requestedOrAccepted = role.requested_count + role.accepted_count

        // Check: Role exists with no crew planned, requested, or accepted
        if (
          role.planned_count === 0 &&
          role.requested_count === 0 &&
          role.accepted_count === 0 &&
          needed > 0
        ) {
          items.push({
            id: `no-crew-planned-${role.id}`,
            type: 'no_crew_planned',
            title: `No Crew Planned: ${role.title}`,
            description: `This role requires ${needed} crew member(s) but no crew has been planned yet.`,
            severity: 'medium',
            actionUrl: `/jobs?jobId=${jobId}&tab=crew`,
            actionLabel: 'Plan Crew',
            metadata: { roleId: role.id, roleTitle: role.title },
          })
        }

        // Check: Crew is planned but not requested
        if (role.planned_count > 0 && role.requested_count === 0) {
          items.push({
            id: `crew-planned-not-requested-${role.id}`,
            type: 'crew_planned_not_requested',
            title: `Crew Planned But Not Requested: ${role.title}`,
            description: `${role.planned_count} crew member(s) are planned but none have been requested yet.`,
            severity: 'medium',
            actionUrl: `/jobs?jobId=${jobId}&tab=crew`,
            actionLabel: 'Request Crew',
            metadata: { roleId: role.id, roleTitle: role.title },
          })
        }

        // Check: Fewer crew requested or accepted than needed
        if (requestedOrAccepted < needed) {
          const missing = needed - requestedOrAccepted
          items.push({
            id: `insufficient-crew-requested-${role.id}`,
            type: 'insufficient_crew_requested',
            title: `Insufficient Crew Requested: ${role.title}`,
            description: `This role needs ${needed} crew member(s), but only ${requestedOrAccepted} have been requested or accepted (${role.requested_count} requested, ${role.accepted_count} accepted). ${missing} more needed.`,
            severity: 'medium',
            actionUrl: `/jobs?jobId=${jobId}&tab=crew`,
            actionLabel: 'Request More Crew',
            metadata: { roleId: role.id, roleTitle: role.title },
          })
        }

        // Legacy check: Unassigned crew roles (kept for backward compatibility)
        // Only show if we haven't already shown a more specific message above
        if (
          role.needed_count > role.assigned_count &&
          role.planned_count > 0 &&
          role.requested_count > 0
        ) {
          const missing = role.needed_count - role.assigned_count
          items.push({
            id: `unassigned-crew-${role.id}`,
            type: 'unassigned_crew',
            title: `Unassigned Crew Role: ${role.title}`,
            description: `${missing} crew member(s) still needed (${role.assigned_count}/${role.needed_count} assigned)`,
            severity: 'medium',
            actionUrl: `/jobs?jobId=${jobId}&tab=crew`,
            actionLabel: 'Assign Crew',
            metadata: { roleId: role.id, roleTitle: role.title },
          })
        }
      })
    }

    // 4. Check for unconfirmed vehicle bookings
    // Note: This is a placeholder - you may need to adjust based on your actual confirmation logic
    // For now, we'll check for external vehicle bookings with certain statuses
    if (vehicleBookings) {
      vehicleBookings.forEach((booking) => {
        // If it's an external vehicle booking, it might need confirmation
        // Adjust this logic based on your actual requirements
        if (booking.is_external && !booking.external_status) {
          items.push({
            id: `unconfirmed-vehicle-${booking.id}`,
            type: 'unconfirmed_vehicle',
            title: `Vehicle Booking Needs Confirmation`,
            description: `External vehicle booking for "${booking.vehicle?.name || 'Unknown Vehicle'}" needs confirmation`,
            severity: 'medium',
            actionUrl: `/jobs?jobId=${jobId}&tab=transport`,
            actionLabel: 'Review Booking',
            metadata: { bookingId: booking.id },
          })
        }
      })
    }

    // 5. Check for completed jobs that aren't invoiced
    if (job.status === 'completed') {
      items.push({
        id: 'uninvoiced-completed',
        type: 'uninvoiced_completed',
        title: 'Job Completed - Invoice Required',
        description:
          'This job is marked as completed but has not been invoiced yet.',
        severity: 'high',
        actionUrl: `/jobs?jobId=${jobId}&tab=invoice`,
        actionLabel: 'Create Invoice',
      })
    }

    return items
  }, [job, crewRoles, vehicleBookings, jobId])

  const getSeverityColor = (severity: TodoItem['severity']) => {
    switch (severity) {
      case 'high':
        return 'red'
      case 'medium':
        return 'orange'
      case 'low':
        return 'blue'
      default:
        return 'gray'
    }
  }

  const handleAction = (item: TodoItem) => {
    if (item.type === 'missing_contact') {
      // Open contact dialog directly
      setContactDialogOpen(true)
    } else if (item.actionUrl) {
      navigate({ to: item.actionUrl })
    }
  }

  if (todoItems.length === 0) {
    return (
      <Box>
        <Heading size="3" mb="3">
          To Do
        </Heading>
        <Card>
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            style={{ minHeight: '300px', padding: '40px' }}
          >
            <CheckCircle width={48} height={48} color="var(--green-9)" />
            <Text size="4" weight="medium">
              All tasks complete!
            </Text>
            <Text size="2" color="gray" align="center">
              There are no pending action items for this job.
            </Text>
          </Flex>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Heading size="3" mb="3">
        To Do ({todoItems.length})
      </Heading>
      <Flex direction="column" gap="3">
        {todoItems.map((item) => (
          <Card key={item.id}>
            <Flex gap="3" align="start">
              <Box style={{ paddingTop: '4px' }}>
                <XmarkCircle
                  width={20}
                  height={20}
                  color={`var(--${getSeverityColor(item.severity)}-9)`}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Flex direction="column" gap="2">
                  <Flex gap="2" align="center">
                    <Heading size="3">{item.title}</Heading>
                    <Box
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: `var(--${getSeverityColor(item.severity)}-3)`,
                        border: `1px solid var(--${getSeverityColor(item.severity)}-6)`,
                      }}
                    >
                      <Text
                        size="1"
                        weight="medium"
                        style={{
                          color: `var(--${getSeverityColor(item.severity)}-11)`,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.severity}
                      </Text>
                    </Box>
                  </Flex>
                  <Text size="2" color="gray">
                    {item.description}
                  </Text>
                  {item.actionUrl && (
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => handleAction(item)}
                    >
                      {item.actionLabel || 'Fix'}
                      <ArrowRight width={14} height={14} />
                    </Button>
                  )}
                </Flex>
              </Box>
            </Flex>
          </Card>
        ))}
      </Flex>
      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        companyId={job.company_id}
        job={job}
      />
    </Box>
  )
}
