// src/features/jobs/components/dialogs/JobDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Separator,
  Text,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { upsertTimePeriod } from '@features/jobs/api/queries'
import { recurringJobsIndexQuery } from '@features/jobs/api/recurringJobQueries'
import {
  DateTimeRangePicker,
  isInvalidTimeRange,
} from '@shared/ui/components/pickers'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@shared/form'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  SearchableSelect,
  preventDialogCloseOnSearchableSelect,
} from '@shared/ui/components/SearchableSelect'
import { logActivity } from '@features/latest/api/queries'
import { Sparks } from 'iconoir-react'
import {
  JOB_AUTOFILL_SEEDS,
  getJobAutofillSeed,
  pickBySeedIndex,
  pickRandomJobAutofillSeedId,
} from '../../utils/jobAutofillSeeds'
import type { JobDetail, JobStatus, UUID } from '../../types'
import type { RecurringJobCreateDefaults } from '../../utils/recurringJobCreateDefaults'

const JOB_STATUSES = [
  'draft',
  'planned',
  'requested',
  'canceled',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
] as const satisfies ReadonlyArray<JobStatus>

type JobFormValues = {
  title: string
  description: string
  status: JobStatus
  startAt: string
  endAt: string
  syncTimePeriods: boolean
  createCrewBookingForProjectLead: boolean
  projectLead: UUID | ''
  isCompanyCustomer: boolean
  customerId: UUID | ''
  customerUserId: UUID | ''
  contactId: UUID | ''
  recurringJobId: UUID | ''
}

const emptyDefaults: JobFormValues = {
  title: '',
  description: '',
  status: 'planned',
  startAt: '',
  endAt: '',
  syncTimePeriods: false,
  createCrewBookingForProjectLead: true,
  projectLead: '',
  isCompanyCustomer: false,
  customerId: '',
  customerUserId: '',
  contactId: '',
  recurringJobId: '',
}

const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string(),
    status: z.enum(JOB_STATUSES),
    startAt: z.string(),
    endAt: z.string(),
    syncTimePeriods: z.boolean(),
    createCrewBookingForProjectLead: z.boolean(),
    projectLead: z.string(),
    isCompanyCustomer: z.boolean(),
    customerId: z.string(),
    customerUserId: z.string(),
    contactId: z.string(),
    recurringJobId: z.string(),
  })
  .refine((v) => !isInvalidTimeRange(v.startAt, v.endAt), {
    message: 'End time must be after start time.',
    path: ['endAt'],
  })

function buildCreateDefaults(
  recurringJobIdProp: UUID | null | undefined,
  recurringJobDefaults?: RecurringJobCreateDefaults,
): JobFormValues {
  const d = recurringJobDefaults
  return {
    title: d?.title ?? '',
    description: d?.description ?? '',
    status: d?.status ?? 'planned',
    startAt: d?.startAt ?? '',
    endAt: d?.endAt ?? '',
    syncTimePeriods: false,
    createCrewBookingForProjectLead: !d?.fromTemplate,
    projectLead: d?.projectLeadUserId ?? '',
    isCompanyCustomer: Boolean(d?.customerUserId),
    customerId: d?.customerId ?? '',
    customerUserId: d?.customerUserId ?? '',
    contactId: d?.customerContactId ?? '',
    recurringJobId: recurringJobIdProp ?? '',
  }
}

function buildEditDefaults(initialData: JobDetail): JobFormValues {
  return {
    title: initialData.title,
    description: initialData.description ?? '',
    status: initialData.status,
    startAt: initialData.start_at ?? '',
    endAt: initialData.end_at ?? '',
    syncTimePeriods: false,
    createCrewBookingForProjectLead: true,
    projectLead: initialData.project_lead_user_id ?? '',
    isCompanyCustomer: Boolean(initialData.customer_user_id),
    customerId: initialData.customer_id ?? '',
    customerUserId: initialData.customer_user_id ?? '',
    contactId: initialData.customer_contact_id ?? '',
    recurringJobId: initialData.recurring_job_id ?? '',
  }
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: UUID
  mode?: 'create' | 'edit'
  initialData?: JobDetail
  recurringJobId?: UUID | null
  recurringJobDefaults?: RecurringJobCreateDefaults
  onSaved?: (id: UUID) => void
}

export default function JobDialog({
  open,
  onOpenChange,
  companyId,
  mode = 'create',
  initialData,
  recurringJobId: recurringJobIdProp,
  recurringJobDefaults,
  onSaved,
}: Props) {
  const qc = useQueryClient()

  const { success, error: showError } = useToast()

  const [autofillSeedId, setAutofillSeedId] = React.useState<number | null>(
    null,
  )
  const pendingAutofillContactIndexRef = React.useRef<number | null>(null)

  const form = useAppForm({
    defaultValues: emptyDefaults,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await upsert.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (mode === 'edit' && initialData) {
      form.reset(buildEditDefaults(initialData), { keepDefaultValues: true })
    } else if (mode === 'create') {
      form.reset(
        buildCreateDefaults(recurringJobIdProp, recurringJobDefaults),
        { keepDefaultValues: true },
      )
      setAutofillSeedId(null)
      pendingAutofillContactIndexRef.current = null
    }
    // Use stable job id — full initialData identity churn would wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [
    open,
    mode,
    initialData?.id,
    recurringJobIdProp,
    recurringJobDefaults,
  ])

  React.useEffect(() => {
    if (!open || mode !== 'create') return
    if (recurringJobDefaults?.projectLeadUserId) return

    const setCurrentUserAsLead = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) return

      const { data: cu, error: cuErr } = await supabase
        .from('company_user_profiles')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (cuErr) return
      if (cu?.role === 'freelancer') return

      form.setFieldValue('projectLead', user.id)
    }

    void setCurrentUserAsLead()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set lead on create open
  }, [open, mode, companyId, recurringJobDefaults?.projectLeadUserId])

  const { data: leads = [] } = useQuery({
    queryKey: ['company', companyId, 'project-leads'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_user_profiles')
        .select('user_id, display_name, email, role')
        .eq('company_id', companyId)
        .neq('role', 'freelancer')
      if (error) throw error
      return data as Array<{
        user_id: UUID
        display_name: string | null
        email: string
        role: string
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

  const { data: recurringJobs = [] } = useQuery({
    ...recurringJobsIndexQuery({ companyId, includeArchived: false }),
    enabled: open,
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

  const customerId = useStore(
    form.store,
    (s: { values: JobFormValues }) => s.values.customerId,
  )

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

  // ===== TESTING ONLY: apply contact index after customer contacts load =====
  React.useEffect(() => {
    const contactIndex = pendingAutofillContactIndexRef.current
    if (contactIndex === null || !customerId || contactsLoading) return
    pendingAutofillContactIndexRef.current = null
    const contact = pickBySeedIndex(contacts, contactIndex)
    form.setFieldValue('contactId', contact?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply pending autofill contact
  }, [customerId, contacts, contactsLoading])

  // Contact/customerUser clears happen in the Select onValueChange handlers.
  // A customerId effect races with form.reset + useStore: the seed flag is
  // consumed on the empty→seeded transition and then wipes contactId.

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
    mutationFn: async (value: JobFormValues) => {
      const {
        title,
        description,
        status,
        startAt,
        endAt,
        syncTimePeriods,
        createCrewBookingForProjectLead,
        projectLead,
        customerId: nextCustomerId,
        customerUserId: nextCustomerUserId,
        contactId,
        recurringJobId,
      } = value

      if (projectLead) {
        const unchangedLead =
          mode === 'edit' && projectLead === initialData?.project_lead_user_id
        const isValidLead =
          unchangedLead || leads.some((l) => l.user_id === projectLead)
        if (!isValidLead) {
          showError(
            'Invalid project lead',
            'Freelancers cannot be set as project lead.',
          )
          form.setFieldValue('projectLead', '')
          throw new Error('Invalid project lead')
        }
      }

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
            customer_id: nextCustomerId || null,
            customer_user_id: nextCustomerUserId || null,
            customer_contact_id: contactId || null,
            recurring_job_id: recurringJobId || recurringJobIdProp || null,
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

        // Optionally create crew booking for project lead (job duration)
        if (
          createCrewBookingForProjectLead &&
          projectLead &&
          (startAt || endAt)
        ) {
          try {
            const periodStart = startAt || new Date().toISOString()
            const periodEnd =
              endAt || new Date(Date.now() + 86400000).toISOString()

            const { data: crewPeriod, error: crewTpError } = await supabase
              .from('time_periods')
              .insert({
                job_id: data.id,
                company_id: companyId,
                title: 'Project lead',
                category: 'crew',
                start_at: periodStart,
                end_at: periodEnd,
                needed_count: 1,
              })
              .select('id')
              .single()

            if (crewTpError) throw crewTpError

            const { error: crewBookingError } = await supabase
              .from('reserved_crew')
              .insert({
                time_period_id: crewPeriod.id,
                user_id: projectLead,
                status: 'confirmed',
                notes: null,
              })

            if (crewBookingError) throw crewBookingError
          } catch (e: any) {
            console.error('Failed to create crew booking for project lead', e)
            // Don't fail the whole job create
          }
        }

        // Create standard crew roles from recurring job template defaults
        if (recurringJobDefaults?.crewRoles?.length && (startAt || endAt)) {
          try {
            const periodStart = startAt || new Date().toISOString()
            const periodEnd =
              endAt || new Date(Date.now() + 86400000).toISOString()

            const { error: crewRolesError } = await supabase
              .from('time_periods')
              .insert(
                recurringJobDefaults.crewRoles.map((role) => ({
                  job_id: data.id,
                  company_id: companyId,
                  title: role.title,
                  category: 'crew' as const,
                  start_at: periodStart,
                  end_at: periodEnd,
                  needed_count: role.needed_count,
                  role_category: role.role_category,
                })),
              )

            if (crewRolesError) throw crewRolesError
          } catch (e: any) {
            console.error('Failed to create template crew roles', e)
          }
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
            customer_id: nextCustomerId || null,
            customer_user_id: nextCustomerUserId || null,
            customer_contact_id: contactId || null,
            recurring_job_id: recurringJobId || null,
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

        // Optionally sync crew, equipment and vehicle time periods to the new job times (shift by delta)
        if (syncTimePeriods && initialData.start_at && startAt) {
          const oldStartMs = new Date(initialData.start_at).getTime()
          const newStartMs = new Date(startAt).getTime()
          const deltaMs = newStartMs - oldStartMs
          if (deltaMs !== 0) {
            const { data: periodsToShift, error: listErr } = await supabase
              .from('time_periods')
              .select('id, start_at, end_at')
              .eq('job_id', initialData.id)
              .neq('title', 'Job duration')
              .in('category', ['crew', 'equipment', 'transport'])
              .or('deleted.is.null,deleted.eq.false')
            if (listErr) throw listErr
            if (periodsToShift.length > 0) {
              for (const tp of periodsToShift) {
                const tpStart = new Date(tp.start_at).getTime()
                const tpEnd = new Date(tp.end_at).getTime()
                const newTpStart = new Date(tpStart + deltaMs).toISOString()
                const newTpEnd = new Date(tpEnd + deltaMs).toISOString()
                const { error: upErr } = await supabase
                  .from('time_periods')
                  .update({ start_at: newTpStart, end_at: newTpEnd })
                  .eq('id', tp.id)
                if (upErr) throw upErr
              }
            }
          }
        }

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
    onSuccess: (id, value) => {
      const action = mode === 'create' ? 'created' : 'updated'
      success(
        `Job ${action}`,
        `"${value.title.trim()}" was ${action} successfully.`,
      )

      if (mode === 'create') {
        form.reset(
          buildCreateDefaults(recurringJobIdProp, recurringJobDefaults),
          { keepDefaultValues: true },
        )
      }
      onOpenChange(false)
      onSaved?.(id)

      void Promise.all([
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
        qc.refetchQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ]).catch((err) => {
        console.error('Failed to refresh job queries after save', err)
      })
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

  const applyAutofillSeed = React.useCallback(
    (seedId: number) => {
      const seed = getJobAutofillSeed(seedId)
      if (!seed) return

      const startDate = new Date()
      startDate.setDate(startDate.getDate() + seed.daysFromNow)
      startDate.setHours(seed.startHour, 0, 0, 0)

      const endDate = new Date(startDate)
      endDate.setHours(endDate.getHours() + seed.durationHours)

      const lead = pickBySeedIndex(leads, seed.projectLeadIndex)
      const customer = pickBySeedIndex(customers, seed.customerIndex)
      const recurring = !recurringJobIdProp
        ? pickBySeedIndex(recurringJobs, seed.recurringJobIndex)
        : null

      const nextCustomerId = customer?.id ?? ''
      form.setFieldValue('title', seed.title)
      form.setFieldValue('description', seed.description)
      form.setFieldValue('status', seed.status)
      form.setFieldValue('startAt', startDate.toISOString())
      form.setFieldValue('endAt', endDate.toISOString())
      form.setFieldValue('projectLead', lead?.user_id ?? '')
      form.setFieldValue('isCompanyCustomer', false)
      form.setFieldValue('customerId', nextCustomerId)
      form.setFieldValue('customerUserId', '')
      form.setFieldValue(
        'createCrewBookingForProjectLead',
        seed.createCrewBooking,
      )
      if (!recurringJobIdProp) {
        form.setFieldValue('recurringJobId', recurring?.id ?? '')
      }

      if (nextCustomerId && seed.contactIndex >= 0) {
        if (nextCustomerId === customerId) {
          pendingAutofillContactIndexRef.current = null
          form.setFieldValue(
            'contactId',
            pickBySeedIndex(contacts, seed.contactIndex)?.id ?? '',
          )
        } else {
          pendingAutofillContactIndexRef.current = seed.contactIndex
          form.setFieldValue('contactId', '')
        }
      } else {
        pendingAutofillContactIndexRef.current = null
        form.setFieldValue('contactId', '')
      }

      setAutofillSeedId(seed.id)
    },
    [
      leads,
      customers,
      recurringJobs,
      recurringJobIdProp,
      customerId,
      contacts,
      form,
    ],
  )

  const autofillSeed = autofillSeedId
    ? getJobAutofillSeed(autofillSeedId)
    : undefined
  // ===== END TESTING ONLY =====

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="820px"
        style={{ display: 'flex', flexDirection: 'column' }}
        onPointerDownOutside={preventDialogCloseOnSearchableSelect}
        onInteractOutside={preventDialogCloseOnSearchableSelect}
      >
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Dialog.Title>
            {mode === 'edit' ? 'Edit job' : 'New job'}
          </Dialog.Title>
          {/* ===== TESTING ONLY: Auto-fill + seed picker ===== */}
          {mode === 'create' && (
            <Flex align="center" gap="2" style={{ marginLeft: 'auto' }}>
              {autofillSeed && (
                <Select.Root
                  value={String(autofillSeed.id)}
                  onValueChange={(value) => applyAutofillSeed(Number(value))}
                >
                  <Select.Trigger
                    variant="soft"
                    placeholder="Seed"
                    style={{ maxWidth: 220 }}
                  />
                  <Select.Content style={{ zIndex: 10000 }}>
                    {JOB_AUTOFILL_SEEDS.map((seed) => (
                      <Select.Item key={seed.id} value={String(seed.id)}>
                        #{seed.id} · {seed.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              )}
              <Button
                size="2"
                variant="soft"
                onClick={() =>
                  applyAutofillSeed(pickRandomJobAutofillSeedId(autofillSeedId))
                }
                type="button"
              >
                <Sparks width={16} height={16} />
                Auto-fill
              </Button>
            </Flex>
          )}
          {/* ===== END TESTING ONLY ===== */}
        </Flex>
        <Separator my="2" />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12,
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
              }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <form.AppField name="title">
                  {(field) => (
                    <field.TextField
                      label="Title"
                      placeholder="Enter job title"
                    />
                  )}
                </form.AppField>

                <Flex wrap={'wrap'}>
                  <form.AppField name="status">
                    {(field) => (
                      <Field label="Status">
                        <Select.Root
                          value={field.state.value}
                          onValueChange={(v) =>
                            field.handleChange(v as JobStatus)
                          }
                        >
                          <Select.Trigger />
                          <Select.Content style={{ zIndex: 10000 }}>
                            {JOB_STATUSES.map((s) => (
                              <Select.Item key={s} value={s}>
                                {makeWordPresentable(s)}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      </Field>
                    )}
                  </form.AppField>

                  <form.AppField name="projectLead">
                    {(field) => (
                      <Field label="Project lead">
                        <SearchableSelect
                          options={leads.map((u) => ({
                            value: u.user_id,
                            label: u.display_name ?? u.email,
                          }))}
                          value={field.state.value}
                          onValueChange={field.handleChange}
                          placeholder="Search project lead…"
                          emptyMessage="No project leads found"
                          dropdownMaxWidth={280}
                          style={{ width: '100%', minWidth: 0 }}
                        />
                      </Field>
                    )}
                  </form.AppField>

                  {(mode === 'edit' || !recurringJobIdProp) && (
                    <form.AppField name="recurringJobId">
                      {(field) => (
                        <Field label="Recurring job">
                          <SearchableSelect
                            options={[
                              { value: '', label: 'None' },
                              ...recurringJobs.map((r) => ({
                                value: r.id,
                                label: r.title,
                              })),
                            ]}
                            value={field.state.value}
                            onValueChange={field.handleChange}
                            placeholder="Link to recurring job…"
                            emptyMessage="No recurring jobs found"
                            dropdownMaxWidth={280}
                            style={{ width: '100%', minWidth: 0 }}
                          />
                        </Field>
                      )}
                    </form.AppField>
                  )}
                </Flex>

                <Flex wrap={'wrap'} direction="column" gap="2">
                  <form.AppField name="isCompanyCustomer">
                    {(field) => (
                      <Flex align="center" gap="2">
                        <Checkbox
                          checked={!!field.state.value}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true
                            field.handleChange(isChecked)
                            if (isChecked) {
                              form.setFieldValue('customerId', '')
                              form.setFieldValue('contactId', '')
                            } else {
                              form.setFieldValue('customerUserId', '')
                            }
                          }}
                        />
                        <Text as="label" size="2">
                          Customer is a member of the company
                        </Text>
                      </Flex>
                    )}
                  </form.AppField>
                  <Box>
                    <form.Subscribe
                      selector={(state) => ({
                        isCompanyCustomer: state.values.isCompanyCustomer,
                        customerId: state.values.customerId,
                        contactId: state.values.contactId,
                        customerUserId: state.values.customerUserId,
                      })}
                    >
                      {({
                        isCompanyCustomer,
                        customerId: selectedCustomerId,
                        contactId: selectedContactId,
                        customerUserId: selectedCustomerUserId,
                      }) => (
                        <>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(auto-fit, minmax(140px, 1fr))',
                              gap: 12,
                              width: '100%',
                            }}
                          >
                            <Field label="Customer">
                              <SearchableSelect
                                options={customers.map((c) => ({
                                  value: c.id,
                                  label: c.name,
                                }))}
                                value={selectedCustomerId}
                                onValueChange={(v) => {
                                  form.setFieldValue('contactId', '')
                                  pendingAutofillContactIndexRef.current = null
                                  if (v) form.setFieldValue('customerUserId', '')
                                  form.setFieldValue('customerId', v)
                                }}
                                disabled={isCompanyCustomer}
                                placeholder={
                                  isCompanyCustomer
                                    ? 'Disabled for company member'
                                    : 'Search customer…'
                                }
                                emptyMessage="No customers found"
                                dropdownMaxWidth={280}
                                style={{ width: '100%', minWidth: 0 }}
                              />
                            </Field>

                            <Field label="Main contact">
                              <SearchableSelect
                                options={contacts.map((c) => ({
                                  value: c.id,
                                  label: c.name,
                                }))}
                                value={selectedContactId}
                                onValueChange={(v) =>
                                  form.setFieldValue('contactId', v)
                                }
                                disabled={
                                  isCompanyCustomer ||
                                  !selectedCustomerId ||
                                  contactsLoading ||
                                  contacts.length === 0
                                }
                                placeholder={
                                  isCompanyCustomer
                                    ? 'Disabled for company member'
                                    : !selectedCustomerId
                                      ? 'Select a customer first'
                                      : contactsLoading
                                        ? 'Loading…'
                                        : 'Search contact…'
                                }
                                emptyMessage="No contacts found"
                                dropdownMaxWidth={280}
                                style={{ width: '100%', minWidth: 0 }}
                              />
                            </Field>
                          </div>

                          {isCompanyCustomer && (
                            <Field label="Customer from company">
                              <SearchableSelect
                                options={companyUsers.map((u) => ({
                                  value: u.user_id,
                                  label: u.display_name ?? u.email,
                                }))}
                                value={selectedCustomerUserId}
                                onValueChange={(v) => {
                                  if (v) {
                                    form.setFieldValue('customerId', '')
                                    form.setFieldValue('contactId', '')
                                  }
                                  form.setFieldValue('customerUserId', v)
                                }}
                                placeholder="Search company member…"
                                emptyMessage="No company members found"
                                dropdownMaxWidth={280}
                                style={{ width: '100%', minWidth: 0 }}
                              />
                            </Field>
                          )}
                        </>
                      )}
                    </form.Subscribe>
                  </Box>
                </Flex>
              </div>

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <form.Subscribe
                  selector={(state) => [
                    state.values.startAt,
                    state.values.endAt,
                  ]}
                >
                  {([startAt, endAt]) => {
                    const timeRangeInvalid = isInvalidTimeRange(startAt, endAt)
                    return (
                      <>
                        <Field label="Time period">
                          <DateTimeRangePicker
                            startAt={startAt}
                            endAt={endAt}
                            onChange={({ startAt: s, endAt: e }) => {
                              form.setFieldValue('startAt', s)
                              form.setFieldValue('endAt', e)
                            }}
                            invalid={timeRangeInvalid}
                          />
                        </Field>
                        {mode === 'create' && (
                          <form.AppField name="createCrewBookingForProjectLead">
                            {(field) => (
                              <field.Checkbox label="Create crew booking for project lead (job duration)" />
                            )}
                          </form.AppField>
                        )}
                        {mode === 'edit' &&
                          initialData &&
                          (startAt !== (initialData.start_at ?? '') ||
                            endAt !== (initialData.end_at ?? '')) && (
                            <form.AppField name="syncTimePeriods">
                              {(field) => (
                                <field.Checkbox label="Sync crew, equipment and vehicle bookings to new times" />
                              )}
                            </form.AppField>
                          )}
                      </>
                    )
                  }}
                </form.Subscribe>

                <form.AppField name="description">
                  {(field) => <field.TextArea label="Notes" rows={5} />}
                </form.AppField>
              </div>
            </div>

            <form.Subscribe
              selector={(state) => ({
                title: state.values.title,
                startAt: state.values.startAt,
                endAt: state.values.endAt,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ title, startAt, endAt, isSubmitting }) => {
                const timeRangeInvalid = isInvalidTimeRange(startAt, endAt)
                const disabled =
                  isSubmitting ||
                  upsert.isPending ||
                  !title.trim() ||
                  (mode === 'create' && (!startAt || !endAt)) ||
                  timeRangeInvalid
                return (
                  <Flex justify="end" gap="2" mt="3">
                    <Dialog.Close>
                      <Button type="button" variant="soft">
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <form.SubmitButton
                      label={mode === 'edit' ? 'Save' : 'Create'}
                      pendingLabel="Saving…"
                      disabled={disabled}
                    />
                  </Flex>
                )
              }}
            </form.Subscribe>
          </form.AppForm>
        </form>
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
