import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Checkbox, Dialog, Flex, Text } from '@radix-ui/themes'
import { format } from 'date-fns'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import {
  SearchableSelect,
  preventDialogCloseOnSearchableSelect,
} from '@shared/ui/components/SearchableSelect'
import {
  createRecurringJob,
  updateRecurringJob,
} from '../../api/recurringJobQueries'
import type { RecurringJobDetail, UUID } from '../../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: UUID
  mode?: 'create' | 'edit'
  initialData?: RecurringJobDetail
  onSaved?: (id: UUID) => void
}

function todayIsoDate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function dateOnlyToPickerValue(dateOnly: string): string {
  if (!dateOnly) return ''
  return `${dateOnly}T12:00:00`
}

function pickerValueToDateOnly(value: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return format(new Date(value), 'yyyy-MM-dd')
}

const defaultValues = {
  title: '',
  description: '',
  projectLead: '' as UUID | '',
  isCompanyCustomer: false,
  customerId: '' as UUID | '',
  customerUserId: '' as UUID | '',
  contactId: '' as UUID | '',
  periodStart: todayIsoDate(),
  periodEnd: '',
}

const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string(),
    projectLead: z.string(),
    isCompanyCustomer: z.boolean(),
    customerId: z.string(),
    customerUserId: z.string(),
    contactId: z.string(),
    periodStart: z.string().min(1, 'Period start is required'),
    periodEnd: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.isCompanyCustomer && data.customerId && !data.contactId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select a contact',
        path: ['contactId'],
      })
    }
    if (
      data.periodStart &&
      data.periodEnd &&
      data.periodEnd < data.periodStart
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Period end must be on or after period start',
        path: ['periodEnd'],
      })
    }
  })

export default function RecurringJobDialog({
  open,
  onOpenChange,
  companyId,
  mode = 'create',
  initialData,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: showError } = useToast()

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
    if (mode === 'edit' && initialData) {
      form.reset(
        {
          title: initialData.title,
          description: initialData.description ?? '',
          projectLead: initialData.project_lead_user_id ?? '',
          isCompanyCustomer: Boolean(initialData.customer_user_id),
          customerId: initialData.customer_id ?? '',
          customerUserId: initialData.customer_user_id ?? '',
          contactId: initialData.customer_contact_id ?? '',
          periodStart: initialData.period_start ?? todayIsoDate(),
          periodEnd: initialData.period_end ?? '',
        },
        { keepDefaultValues: true },
      )
    } else {
      form.reset(
        {
          ...defaultValues,
          periodStart: todayIsoDate(),
          periodEnd: '',
        },
        { keepDefaultValues: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, mode, initialData?.id])

  React.useEffect(() => {
    if (!open || mode !== 'create') return
    const setCurrentUserAsLead = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) return
      const { data: cu } = await supabase
        .from('company_user_profiles')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (cu?.role === 'freelancer') return
      form.setFieldValue('projectLead', user.id)
    }
    void setCurrentUserAsLead()
    // Set lead on create open
  }, [open, mode, companyId])

  const customerId = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.customerId,
  )

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

  const save = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      const periodStart = pickerValueToDateOnly(value.periodStart)
      const periodEnd = value.periodEnd
        ? pickerValueToDateOnly(value.periodEnd)
        : null

      if (mode === 'create') {
        return createRecurringJob({
          companyId,
          title: value.title,
          description: value.description || null,
          projectLeadUserId: value.projectLead || null,
          customerId: value.customerId || null,
          customerUserId: value.customerUserId || null,
          customerContactId: value.contactId || null,
          periodStart,
          periodEnd,
        })
      }
      if (!initialData) throw new Error('Missing recurring job')
      await updateRecurringJob({
        id: initialData.id,
        title: value.title,
        description: value.description || null,
        projectLeadUserId: value.projectLead || null,
        customerId: value.customerId || null,
        customerUserId: value.customerUserId || null,
        customerContactId: value.contactId || null,
        periodStart,
        periodEnd,
      })
      return initialData.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'recurring-jobs-index'],
      })
      qc.invalidateQueries({ queryKey: ['recurring-jobs-detail', id] })
      qc.invalidateQueries({
        queryKey: ['home', companyId, 'active-recurring-jobs'],
      })
      success(
        mode === 'create' ? 'Recurring job created' : 'Recurring job updated',
      )
      onOpenChange(false)
      onSaved?.(id)
    },
    onError: (err: Error) => {
      showError('Failed to save', err.message)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="480px"
        onPointerDownOutside={preventDialogCloseOnSearchableSelect}
        onInteractOutside={preventDialogCloseOnSearchableSelect}
      >
        <Dialog.Title>
          {mode === 'create' ? 'New recurring job' : 'Edit recurring job'}
        </Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Group related jobs together for a shared overview. Each show or date
          remains its own job.
        </Dialog.Description>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3">
              <form.AppField name="title">
                {(field) => (
                  <field.TextField
                    label="Title"
                    placeholder="e.g. National Theatre — Spring 2026"
                  />
                )}
              </form.AppField>

              <form.AppField name="description">
                {(field) => (
                  <field.TextArea
                    label="Notes"
                    placeholder="Internal notes for this recurring job series"
                    rows={4}
                  />
                )}
              </form.AppField>

              <Flex gap="3" wrap="wrap">
                <form.AppField name="periodStart">
                  {(field) => (
                    <Box style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <DateTimePicker
                        dateOnly
                        label="Period start"
                        value={dateOnlyToPickerValue(field.state.value)}
                        onChange={(v) =>
                          field.handleChange(pickerValueToDateOnly(v))
                        }
                        invalid={field.state.meta.errors.length > 0}
                        locale="nb"
                      />
                      {field.state.meta.errors[0] != null && (
                        <Text size="1" color="red" mt="1" as="div">
                          {String(field.state.meta.errors[0])}
                        </Text>
                      )}
                    </Box>
                  )}
                </form.AppField>

                <form.AppField name="periodEnd">
                  {(field) => (
                    <Box style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <DateTimePicker
                        dateOnly
                        label="Period end (optional)"
                        placeholder="Open-ended"
                        value={dateOnlyToPickerValue(field.state.value)}
                        onChange={(v) =>
                          field.handleChange(pickerValueToDateOnly(v))
                        }
                        invalid={field.state.meta.errors.length > 0}
                        locale="nb"
                      />
                      {field.state.meta.errors[0] != null && (
                        <Text size="1" color="red" mt="1" as="div">
                          {String(field.state.meta.errors[0])}
                        </Text>
                      )}
                    </Box>
                  )}
                </form.AppField>
              </Flex>

              <form.AppField name="projectLead">
                {(field) => (
                  <Flex direction="column" gap="1">
                    <Text as="label" size="2" weight="medium">
                      Project lead
                    </Text>
                    <SearchableSelect
                      options={leads.map((l) => ({
                        value: l.user_id,
                        label: l.display_name || l.email,
                      }))}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      placeholder="Search project lead…"
                      emptyMessage="No project leads found"
                      style={{ width: '100%', minWidth: 0 }}
                    />
                  </Flex>
                )}
              </form.AppField>

              <form.AppField name="isCompanyCustomer">
                {(field) => (
                  <Flex align="center" gap="2">
                    <Checkbox
                      checked={!!field.state.value}
                      onCheckedChange={(v) => {
                        field.handleChange(v === true)
                        if (v) {
                          form.setFieldValue('customerId', '')
                        } else {
                          form.setFieldValue('customerUserId', '')
                        }
                      }}
                    />
                    <Text as="label" size="2">
                      Customer is a company member
                    </Text>
                  </Flex>
                )}
              </form.AppField>

              <form.Subscribe
                selector={(state) => state.values.isCompanyCustomer}
              >
                {(isCompanyCustomer) =>
                  isCompanyCustomer ? (
                    <form.AppField name="customerUserId">
                      {(field) => (
                        <Flex direction="column" gap="1">
                          <Text as="div" size="2" weight="medium">
                            Company member
                          </Text>
                          <SearchableSelect
                            options={companyUsers.map((u) => ({
                              value: u.user_id,
                              label: u.display_name || u.email,
                            }))}
                            value={field.state.value}
                            onValueChange={(v) => {
                              field.handleChange(v)
                              form.setFieldValue('customerId', '')
                              form.setFieldValue('contactId', '')
                            }}
                            placeholder="Select member"
                            style={{ width: '100%', minWidth: 0 }}
                          />
                        </Flex>
                      )}
                    </form.AppField>
                  ) : (
                    <>
                      <form.AppField name="customerId">
                        {(field) => (
                          <Flex direction="column" gap="1">
                            <Text as="div" size="2" weight="medium">
                              Customer
                            </Text>
                            <SearchableSelect
                              options={customers.map((c) => ({
                                value: c.id,
                                label: c.name,
                              }))}
                              value={field.state.value}
                              onValueChange={(v) => {
                                field.handleChange(v)
                                form.setFieldValue('customerUserId', '')
                                form.setFieldValue('contactId', '')
                              }}
                              placeholder="Select customer"
                              style={{ width: '100%', minWidth: 0 }}
                            />
                          </Flex>
                        )}
                      </form.AppField>

                      <form.AppField name="contactId">
                        {(field) => (
                          <Flex direction="column" gap="1">
                            <Text as="div" size="2" weight="medium">
                              Standard contact
                            </Text>
                            <SearchableSelect
                              options={contacts.map((c) => ({
                                value: c.id,
                                label: c.name,
                              }))}
                              value={field.state.value}
                              onValueChange={field.handleChange}
                              disabled={
                                !customerId ||
                                contactsLoading ||
                                contacts.length === 0
                              }
                              placeholder={
                                !customerId
                                  ? 'Select a customer first'
                                  : contactsLoading
                                    ? 'Loading…'
                                    : contacts.length === 0
                                      ? 'No contacts for this customer'
                                      : 'Select contact'
                              }
                              emptyMessage="No contacts found"
                              style={{ width: '100%', minWidth: 0 }}
                            />
                            {field.state.meta.errors[0] != null && (
                              <Text size="1" color="red" as="div">
                                {String(field.state.meta.errors[0])}
                              </Text>
                            )}
                          </Flex>
                        )}
                      </form.AppField>
                    </>
                  )
                }
              </form.Subscribe>
            </Flex>

            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button type="button" variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton
                label={mode === 'create' ? 'Create' : 'Save'}
                pendingLabel="Saving…"
              />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
