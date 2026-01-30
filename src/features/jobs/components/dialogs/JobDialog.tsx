// src/features/jobs/components/dialogs/JobDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { upsertTimePeriod } from '@features/jobs/api/queries'
import {
  addThreeHours,
  makeWordPresentable,
} from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { logActivity } from '@features/latest/api/queries'
import { Sparks } from 'iconoir-react'
import type { JobDetail, JobStatus, UUID } from '../../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: UUID
  mode?: 'create' | 'edit'
  initialData?: JobDetail
  onSaved?: (id: UUID) => void
}

export default function JobDialog({
  open,
  onOpenChange,
  companyId,
  mode = 'create',
  initialData,
  onSaved,
}: Props) {
  const qc = useQueryClient()

  const { success, error: showError } = useToast()

  const [title, setTitle] = React.useState(initialData?.title ?? '')
  const [description, setDescription] = React.useState(
    initialData?.description ?? '',
  )
  const [status, setStatus] = React.useState<JobStatus>(
    initialData?.status ?? 'planned',
  )
  const [startAt, setStartAt] = React.useState(initialData?.start_at ?? '')
  const [endAt, setEndAt] = React.useState(initialData?.end_at ?? '')
  const [autoSetEndTime, setAutoSetEndTime] = React.useState(true)
  const [projectLead, setProjectLead] = React.useState<UUID | ''>(
    initialData?.project_lead_user_id ?? '',
  )
  const [isCompanyCustomer, setIsCompanyCustomer] = React.useState(
    Boolean(initialData?.customer_user_id),
  )
  const [customerId, setCustomerId] = React.useState<UUID | ''>(
    initialData?.customer_id ?? '',
  )
  const [customerUserId, setCustomerUserId] = React.useState<UUID | ''>(
    initialData?.customer_user_id ?? '',
  )
  const [contactId, setContactId] = React.useState<UUID | ''>(
    initialData?.customer_contact_id ?? '',
  )
  const resetCreateFields = React.useCallback(() => {
    setTitle('')
    setDescription('')
    setStatus('planned')
    setStartAt('')
    setEndAt('')
    setAutoSetEndTime(true)
    setProjectLead('')
    setIsCompanyCustomer(false)
    setCustomerId('')
    setCustomerUserId('')
    setContactId('')
  }, [])
  const getDateMs = (value: string) => {
    const ms = new Date(value).getTime()
    return Number.isNaN(ms) ? null : ms
  }
  const hasInvalidTimeRange = (() => {
    const startMs = getDateMs(startAt)
    const endMs = getDateMs(endAt)
    if (startMs === null || endMs === null) return false
    return endMs < startMs
  })()

  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    setTitle(initialData.title)
    setDescription(initialData.description ?? '')
    setStatus(initialData.status)
    setStartAt(initialData.start_at ?? '')
    setEndAt(initialData.end_at ?? '')
    setAutoSetEndTime(false) // Don't auto-set when loading existing data
    setProjectLead(initialData.project_lead_user_id ?? '')
    setIsCompanyCustomer(Boolean(initialData.customer_user_id))
    setCustomerId(initialData.customer_id ?? '')
    setCustomerUserId(initialData.customer_user_id ?? '')
    setContactId(initialData.customer_contact_id ?? '')
  }, [open, mode, initialData])

  React.useEffect(() => {
    if (!open || mode !== 'create') return
    resetCreateFields()
  }, [open, mode, resetCreateFields])

  // Auto-set end time when start time changes (only in create mode or when manually setting)
  React.useEffect(() => {
    if (!startAt || mode === 'edit' || !autoSetEndTime) return
    setEndAt(addThreeHours(startAt))
  }, [startAt, mode, autoSetEndTime])

  React.useEffect(() => {
    setContactId('') // clear previous selection if customer changes
    if (customerId) {
      setCustomerUserId('') // clear user selection if customer is selected
    }
  }, [customerId])

  React.useEffect(() => {
    if (customerUserId) {
      setCustomerId('') // clear customer selection if user is selected
      setContactId('') // clear contact selection when user is selected
    }
  }, [customerUserId])

  // Set current user as project lead when creating a new job
  React.useEffect(() => {
    if (!open || mode !== 'create') return

    const setCurrentUserAsLead = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.id) {
        setProjectLead(user.id)
      }
    }

    setCurrentUserAsLead()
  }, [open, mode])

  const { data: leads = [] } = useQuery({
    queryKey: ['company', companyId, 'project-leads'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
      if (error) throw error
      return data as Array<{
        user_id: UUID
        display_name: string | null
        email: string
      }>
    },
  })

  const { data: companyUsers = [] } = useQuery({
    queryKey: ['company', companyId, 'users-for-customer'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_user_profiles')
        .select('user_id, display_name, email, role')
        .eq('company_id', companyId)
      if (error) throw error
      return data as Array<{
        user_id: UUID
        display_name: string | null
        email: string
        role: string
      }>
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['company', companyId, 'customers'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .or('deleted.is.null,deleted.eq.false')
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<{ id: UUID; name: string }>
    },
  })

  const { data: contacts = [], isFetching: contactsLoading } = useQuery({
    queryKey: ['company', companyId, 'customer', customerId, 'contacts'],
    enabled: open && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<{
        id: UUID
        name: string
        email: string | null
        phone: string | null
      }>
    },
  })

  const contactLabel = (c: {
    name: string
    email: string | null
    phone: string | null
  }) => [c.name, c.email, c.phone].filter(Boolean).join(' · ')

  const cascadeBookingStatus = async (jobId: UUID, nextStatus: JobStatus) => {
    if (nextStatus !== 'confirmed' && nextStatus !== 'canceled') return

    const { data: timePeriods, error: tpErr } = await supabase
      .from('time_periods')
      .select('id')
      .eq('job_id', jobId)
    if (tpErr) throw tpErr

    const timePeriodIds = timePeriods.map((tp) => tp.id)
    if (!timePeriodIds.length) return

    const { error: itemsErr } = await supabase
      .from('reserved_items')
      .update({ status: nextStatus })
      .in('time_period_id', timePeriodIds)
      .eq('status', 'planned')
    if (itemsErr) throw itemsErr

    const { error: crewErr } = await supabase
      .from('reserved_crew')
      .update({ status: nextStatus })
      .in('time_period_id', timePeriodIds)
      .eq('status', 'planned')
    if (crewErr) throw crewErr

    const { error: vehicleErr } = await supabase
      .from('reserved_vehicles')
      .update({ status: nextStatus })
      .in('time_period_id', timePeriodIds)
      .eq('status', 'planned')
    if (vehicleErr) throw vehicleErr

    if (nextStatus === 'confirmed') {
      const { error: itemsExternalErr } = await supabase
        .from('reserved_items')
        .update({ external_status: 'confirmed' })
        .in('time_period_id', timePeriodIds)
        .eq('external_status', 'planned')
      if (itemsExternalErr) throw itemsExternalErr

      const { error: vehiclesExternalErr } = await supabase
        .from('reserved_vehicles')
        .update({ external_status: 'confirmed' })
        .in('time_period_id', timePeriodIds)
        .eq('external_status', 'planned')
      if (vehiclesExternalErr) throw vehiclesExternalErr
    }
  }

  // ...unchanged imports
  // const { success, info, error } = useToast()  // you already have this

  const upsert = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        const { data, error } = await supabase
          .from('jobs')
          .insert({
            company_id: companyId,
            title: title.trim(),
            description: description || null,
            status,
            start_at: startAt || null,
            end_at: endAt || null,
            project_lead_user_id: projectLead || null,
            customer_id: customerId || null,
            customer_user_id: customerUserId || null,
            customer_contact_id: contactId || null,
          })
          .select('id')
          .single()
        if (error) throw error

        // Always create a "Job duration" time period
        try {
          const periodStart = startAt || new Date().toISOString()
          const periodEnd =
            endAt || new Date(Date.now() + 86400000).toISOString() // +1 day

          await upsertTimePeriod({
            job_id: data.id,
            company_id: companyId,
            title: 'Job duration',
            start_at: periodStart,
            end_at: periodEnd,
            category: 'program',
          })
        } catch (e: any) {
          // Don't fail the whole job create if time period fails
          // But show a warning to the user so they're aware
          console.error('Failed to create Job duration time period', e)
          // Note: We don't show a toast here because success() will fire from onSuccess
          // and we don't want to confuse the user with an error after showing success
        }

        // Log activity for job creation
        try {
          await logActivity({
            companyId,
            activityType: 'job_created',
            metadata: {
              job_id: data.id,
              job_title: title.trim(),
              status: status,
            },
            title: title.trim(),
          })
        } catch (logErr) {
          console.error('Failed to log job creation activity:', logErr)
          // Don't fail the whole job create if logging fails
        }

        return data.id
      } else {
        if (!initialData) throw new Error('Missing initial data')
        const previousStatus = initialData.status
        const { error } = await supabase
          .from('jobs')
          .update({
            title: title.trim(),
            description: description || null,
            status,
            start_at: startAt || null,
            end_at: endAt || null,
            project_lead_user_id: projectLead || null,
            customer_id: customerId || null,
            customer_user_id: customerUserId || null,
            customer_contact_id: contactId || null,
          })
          .eq('id', initialData.id)
        if (error) throw error

        // Always keep the "Job duration" time period in sync with the job
        // Find existing "Job duration" for this job (if any)
        const { data: existing, error: exErr } = await supabase
          .from('time_periods')
          .select('id')
          .eq('job_id', initialData.id)
          .eq('title', 'Job duration')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (exErr) throw exErr

        // Use provided dates or defaults
        const periodStart = startAt || new Date().toISOString()
        const periodEnd = endAt || new Date(Date.now() + 86400000).toISOString() // +1 day

        // Upsert with new dates
        await upsertTimePeriod({
          id: existing?.id, // update if found, else create
          job_id: initialData.id,
          company_id: companyId,
          title: 'Job duration',
          start_at: periodStart,
          end_at: periodEnd,
        })

        if (
          previousStatus !== status &&
          (status === 'confirmed' || status === 'canceled')
        ) {
          await cascadeBookingStatus(initialData.id, status)
        }

        // Log activity if status changed to confirmed, canceled, or paid
        if (
          previousStatus !== status &&
          (status === 'confirmed' || status === 'canceled' || status === 'paid')
        ) {
          try {
            await logActivity({
              companyId,
              activityType: 'job_status_changed',
              metadata: {
                job_id: initialData.id,
                job_title: title.trim(),
                previous_status: previousStatus,
                new_status: status,
              },
              title: title.trim(),
            })
          } catch (logErr) {
            console.error('Failed to log job status change activity:', logErr)
            // Don't fail the whole job update if logging fails
          }
        }

        return initialData.id
      }
    },
    onSuccess: async (id) => {
      const action = mode === 'create' ? 'created' : 'updated'
      // fire toast first so the user sees it even if the dialog closes quickly
      success(`Job ${action}`, `“${title.trim()}” was ${action} successfully.`)

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs-index'], exact: false }),
        qc.invalidateQueries({ queryKey: ['jobs-detail', id], exact: false }),
        qc.invalidateQueries({
          queryKey: ['jobs', id, 'time_periods'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
        // Force refetch of latest feed to ensure new activity appears immediately
        qc.refetchQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])

      if (mode === 'create') {
        resetCreateFields()
      }
      onOpenChange(false)
      onSaved?.(id)
    },
    onError: (e: any) => {
      const errorMessage = String(e?.message ?? '')
      const isInvalidTimeRange =
        errorMessage.includes(
          'range lower bound must be less than or equal to range upper bound',
        ) ||
        errorMessage.includes('range lower bound must be less than or equal')

      if (isInvalidTimeRange) {
        showError('Invalid time range', 'End time is before the start time.')
        return
      }

      showError('Failed to save job', errorMessage || 'Please try again.')
      // (Optional) keep the dialog open so they can fix inputs
      // You already keep it open by default on error since onOpenChange(false) is only in onSuccess
    },
  })

  const disabled =
    upsert.isPending ||
    !title.trim() ||
    (mode === 'create' && (!startAt || !endAt)) ||
    hasInvalidTimeRange

  // ===== TESTING ONLY: Auto-populate function =====
  // TODO: Remove this function and button when testing is complete
  const autoPopulateFields = () => {
    const jobTitles = [
      'Corporate Event Setup',
      'Concert Production',
      'Conference AV',
      'Wedding Sound & Lighting',
      'Festival Stage Management',
      'Corporate Presentation',
      'Live Streaming Setup',
      'Theater Production',
      'Trade Show Installation',
      'Product Launch Event',
    ]
    const descriptions = [
      'Full production setup for corporate event',
      'Complete concert production package',
      'AV equipment for conference',
      'Sound and lighting for wedding',
      'Stage management for festival',
      'Presentation equipment setup',
      'Live streaming equipment package',
      'Theater production equipment',
      'Trade show installation and setup',
      'Product launch event production',
    ]
    const statuses: Array<JobStatus> = [
      'planned',
      'requested',
      'confirmed',
      'in_progress',
    ]

    const randomTitle = jobTitles[Math.floor(Math.random() * jobTitles.length)]
    const randomDescription =
      descriptions[Math.floor(Math.random() * descriptions.length)]
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]

    // Set dates: start in 1-30 days, end 3-8 hours after start
    const daysFromNow = Math.floor(Math.random() * 30) + 1
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + daysFromNow)
    startDate.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0) // 9 AM - 5 PM

    const endDate = new Date(startDate)
    const hoursToAdd = 3 + Math.floor(Math.random() * 5) // 3-8 hours
    endDate.setHours(endDate.getHours() + hoursToAdd)

    const startAtStr = startDate.toISOString()
    const endAtStr = endDate.toISOString()

    // Set random project lead if available
    const randomLead =
      leads.length > 0 ? leads[Math.floor(Math.random() * leads.length)] : null

    // Set random customer if available
    const randomCustomer =
      customers.length > 0
        ? customers[Math.floor(Math.random() * customers.length)]
        : null

    setTitle(randomTitle)
    setDescription(randomDescription)
    setStatus(randomStatus)
    setStartAt(startAtStr)
    setEndAt(endAtStr)
    setAutoSetEndTime(false)
    setProjectLead(randomLead?.user_id ?? '')
    setIsCompanyCustomer(false)
    setCustomerId(randomCustomer?.id ?? '')
    setCustomerUserId('')
    setContactId('')
  }
  // ===== END TESTING ONLY =====

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="820px"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <Flex align="center" justify="between">
          <Dialog.Title>
            {mode === 'edit' ? 'Edit job' : 'New job'}
          </Dialog.Title>
          {/* ===== TESTING ONLY: Auto-fill button ===== */}
          {mode === 'create' && (
            <Button
              size="2"
              variant="soft"
              onClick={autoPopulateFields}
              type="button"
              style={{ marginLeft: 'auto' }}
            >
              <Sparks width={16} height={16} />
              Auto-fill
            </Button>
          )}
          {/* ===== END TESTING ONLY ===== */}
        </Flex>
        <Separator my="2" />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Title">
              <TextField.Root
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter job title"
              />
            </Field>

            <Flex wrap={'wrap'}>
              <Field label="Status">
                <Select.Root
                  value={status}
                  onValueChange={(v) => setStatus(v as JobStatus)}
                >
                  <Select.Trigger />
                  <Select.Content style={{ zIndex: 10000 }}>
                    {(
                      [
                        'draft',
                        'planned',
                        'requested',
                        'canceled',
                        'confirmed',
                        'in_progress',
                        'completed',
                        'invoiced',
                        'paid',
                      ] as Array<JobStatus>
                    ).map((s) => (
                      <Select.Item key={s} value={s}>
                        {makeWordPresentable(s)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>

              <Field label="Project lead">
                <Select.Root
                  value={projectLead}
                  onValueChange={(v) => setProjectLead(v)}
                >
                  <Select.Trigger placeholder="None" />
                  <Select.Content style={{ zIndex: 10000 }}>
                    {leads.map((u) => (
                      <Select.Item key={u.user_id} value={u.user_id}>
                        {u.display_name ?? u.email}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>
            </Flex>

            <Flex wrap={'wrap'}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Checkbox
                  checked={isCompanyCustomer}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true
                    setIsCompanyCustomer(isChecked)
                    if (isChecked) {
                      setCustomerId('')
                      setContactId('')
                    } else {
                      setCustomerUserId('')
                    }
                  }}
                />
                <Text size="2">Customer is a member of the company</Text>
              </label>
              <Field label="Customer">
                <Select.Root
                  value={customerId}
                  onValueChange={(v) => setCustomerId(v)}
                  disabled={isCompanyCustomer}
                >
                  <Select.Trigger
                    placeholder={
                      isCompanyCustomer ? 'Disabled for company member' : 'None'
                    }
                  />
                  <Select.Content style={{ zIndex: 10000 }}>
                    {customers.map((c) => (
                      <Select.Item key={c.id} value={c.id}>
                        {c.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>

              <Field label="Main contact">
                <Select.Root
                  value={contactId}
                  onValueChange={(v) => setContactId(v)}
                  disabled={
                    isCompanyCustomer ||
                    !customerId ||
                    contactsLoading ||
                    contacts.length === 0
                  }
                >
                  <Select.Trigger
                    placeholder={
                      isCompanyCustomer
                        ? 'Disabled for company member'
                        : !customerId
                          ? 'Select a customer first'
                          : contactsLoading
                            ? 'Loading…'
                            : contacts.length === 0
                              ? 'No contacts found'
                              : 'None'
                    }
                  />
                  <Select.Content style={{ zIndex: 10000 }}>
                    {contacts.map((c) => (
                      <Select.Item key={c.id} value={c.id}>
                        {contactLabel(c)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>

              {isCompanyCustomer && (
                <Field label="Customer from company">
                  <Select.Root
                    value={customerUserId}
                    onValueChange={(v) => setCustomerUserId(v)}
                  >
                    <Select.Trigger placeholder="None" />
                    <Select.Content style={{ zIndex: 10000 }}>
                      {companyUsers.map((u) => (
                        <Select.Item key={u.user_id} value={u.user_id}>
                          {u.display_name ?? u.email}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Field>
              )}
            </Flex>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <DateTimePicker
              label="Start"
              value={startAt}
              onChange={(value) => {
                setStartAt(value)
                setAutoSetEndTime(true)
              }}
            />
            <DateTimePicker
              label="End"
              value={endAt}
              invalid={hasInvalidTimeRange}
              onChange={(value) => {
                setEndAt(value)
                setAutoSetEndTime(false)
              }}
            />
            <Field label="Notes">
              <TextArea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => {
              if (!title.trim()) {
                return showError('Missing title', 'Please enter a job title.')
              }
              if (hasInvalidTimeRange) {
                return showError(
                  'Invalid time range',
                  'End time must be after start time.',
                )
              }
              upsert.mutate()
            }}
            disabled={disabled}
          >
            {upsert.isPending ? 'Saving…' : mode === 'edit' ? 'Save' : 'Create'}
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
    <div style={{ minWidth: 160 }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}
