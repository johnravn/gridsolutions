import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
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

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [projectLead, setProjectLead] = React.useState<UUID | ''>('')
  const [isCompanyCustomer, setIsCompanyCustomer] = React.useState(false)
  const [customerId, setCustomerId] = React.useState<UUID | ''>('')
  const [customerUserId, setCustomerUserId] = React.useState<UUID | ''>('')
  const [contactId, setContactId] = React.useState<UUID | ''>('')
  const applyingDefaultsRef = React.useRef(false)

  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    applyingDefaultsRef.current = true
    setTitle(initialData.title)
    setDescription(initialData.description ?? '')
    setProjectLead(initialData.project_lead_user_id ?? '')
    setIsCompanyCustomer(Boolean(initialData.customer_user_id))
    setCustomerId(initialData.customer_id ?? '')
    setCustomerUserId(initialData.customer_user_id ?? '')
    setContactId(initialData.customer_contact_id ?? '')
  }, [open, mode, initialData])

  React.useEffect(() => {
    if (!open || mode !== 'create') return
    applyingDefaultsRef.current = true
    setTitle('')
    setDescription('')
    setProjectLead('')
    setIsCompanyCustomer(false)
    setCustomerId('')
    setCustomerUserId('')
    setContactId('')
  }, [open, mode])

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
      setProjectLead(user.id)
    }
    setCurrentUserAsLead()
  }, [open, mode, companyId])

  React.useEffect(() => {
    if (applyingDefaultsRef.current) {
      applyingDefaultsRef.current = false
      return
    }
    if (customerId) setCustomerUserId('')
    setContactId('')
  }, [customerId])

  React.useEffect(() => {
    if (customerUserId) {
      setCustomerId('')
      setContactId('')
    }
  }, [customerUserId])

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
    mutationFn: async () => {
      if (mode === 'create') {
        return createRecurringJob({
          companyId,
          title,
          description: description || null,
          projectLeadUserId: projectLead || null,
          customerId: customerId || null,
          customerUserId: customerUserId || null,
          customerContactId: contactId || null,
        })
      }
      if (!initialData) throw new Error('Missing recurring job')
      await updateRecurringJob({
        id: initialData.id,
        title,
        description: description || null,
        projectLeadUserId: projectLead || null,
        customerId: customerId || null,
        customerUserId: customerUserId || null,
        customerContactId: contactId || null,
      })
      return initialData.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'recurring-jobs-index'],
      })
      qc.invalidateQueries({ queryKey: ['recurring-jobs-detail', id] })
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

  const needsContact = !isCompanyCustomer && !!customerId
  const disabled =
    save.isPending || !title.trim() || (needsContact && !contactId)

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

        <Flex direction="column" gap="3">
          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Title
            </Text>
            <TextField.Root
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National Theatre — Spring 2026"
            />
          </label>

          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Notes
            </Text>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Internal notes for this recurring job series"
              rows={4}
            />
          </label>

          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Project lead
            </Text>
            <Select.Root
              value={projectLead || undefined}
              onValueChange={(v) => setProjectLead(v)}
            >
              <Select.Trigger placeholder="Select project lead" />
              <Select.Content>
                {leads.map((l) => (
                  <Select.Item key={l.user_id} value={l.user_id}>
                    {l.display_name || l.email}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </label>

          <Flex align="center" gap="2">
            <Checkbox
              checked={isCompanyCustomer}
              onCheckedChange={(v) => {
                setIsCompanyCustomer(v === true)
                if (v) {
                  setCustomerId('')
                } else {
                  setCustomerUserId('')
                }
              }}
            />
            <Text as="label" size="2">
              Customer is a company member
            </Text>
          </Flex>

          {isCompanyCustomer ? (
            <>
              <Text as="div" size="2" mb="1" weight="medium">
                Company member
              </Text>
              <SearchableSelect
                options={companyUsers.map((u) => ({
                  value: u.user_id,
                  label: u.display_name || u.email,
                }))}
                value={customerUserId}
                onValueChange={(v) => setCustomerUserId(v)}
                placeholder="Select member"
              />
            </>
          ) : (
            <>
              <Text as="div" size="2" mb="1" weight="medium">
                Customer
              </Text>
              <SearchableSelect
                options={customers.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={customerId}
                onValueChange={(v) => setCustomerId(v)}
                placeholder="Select customer"
              />

              <Text as="div" size="2" mb="1" weight="medium">
                Standard contact
              </Text>
              <SearchableSelect
                options={contacts.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={contactId}
                onValueChange={(v) => setContactId(v)}
                disabled={
                  !customerId || contactsLoading || contacts.length === 0
                }
                placeholder={
                  !customerId
                    ? 'Select a customer first'
                    : contactsLoading
                      ? 'Loading…'
                      : 'Select contact'
                }
                emptyMessage="No contacts found"
              />
            </>
          )}
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
          <Button disabled={disabled} onClick={() => save.mutate()}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
