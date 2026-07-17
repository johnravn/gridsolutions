// src/features/jobs/components/dialogs/AddContactDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  SegmentedControl,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { fuzzySearch } from '@shared/lib/generalFunctions'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { useToast } from '@shared/ui/toast/ToastProvider'
import type { UUID } from '../../types'

const roleSuggestions = [
  'Venue contact',
  'Site manager',
  'Technical support',
  'Supplier',
]

const defaultValues = {
  mode: 'existing' as 'existing' | 'new',
  contactId: '' as UUID | '',
  searchQuery: '',
  role: '',
  notes: '',
  name: '',
  email: '',
  phone: '',
  title: '',
  companyText: '',
}

const schema = z
  .object({
    mode: z.enum(['existing', 'new']),
    contactId: z.string(),
    searchQuery: z.string(),
    role: z.string(),
    notes: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    title: z.string(),
    companyText: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'existing' && !data.contactId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pick a contact',
        path: ['contactId'],
      })
    }
    if (data.mode === 'new' && !data.name.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Name is required',
        path: ['name'],
      })
    }
  })

export default function AddContactDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  companyId: UUID
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

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
    if (open) form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  const searchQuery = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.searchQuery,
  )
  const mode = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.mode,
  )

  const { data: contacts = [] } = useQuery({
    queryKey: ['company', companyId, 'contacts', searchQuery],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('contacts')
        .select('id, name, email, phone, title')
        .eq('company_id', companyId)
        .order('name', { ascending: true })

      if (searchQuery.trim()) {
        const term = searchQuery.trim()
        const patterns = [
          `%${term}%`,
          term.length > 2 ? `%${term.split('').join('%')}%` : null,
        ].filter(Boolean) as Array<string>

        const conditions = patterns
          .flatMap((pattern) => [
            `name.ilike.${pattern}`,
            `email.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
          ])
          .join(',')

        q = q.or(conditions)
      }

      const { data, error } = await q.limit(20)
      if (error) throw error
      return data as Array<{
        id: UUID
        name: string
        email: string | null
        phone: string | null
        title: string | null
      }>
    },
  })

  const filteredContacts = React.useMemo(() => {
    if (!searchQuery.trim()) return contacts
    return fuzzySearch(
      contacts,
      searchQuery,
      [(c) => c.name, (c) => c.email ?? '', (c) => c.phone ?? ''],
      0.25,
    )
  }, [contacts, searchQuery])

  const save = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      let cid: UUID
      if (value.mode === 'existing') {
        if (!value.contactId) throw new Error('Pick a contact')
        cid = value.contactId
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            company_id: companyId,
            name: value.name.trim(),
            email: value.email || null,
            phone: value.phone || null,
            title: value.title || null,
            company_text: value.companyText || null,
          })
          .select('id')
          .single()
        if (error) throw error
        cid = data.id
      }
      const { error: linkErr } = await supabase.from('job_contacts').insert({
        job_id: jobId,
        contact_id: cid,
        role: value.role.trim() || null,
        notes: value.notes || null,
      })
      if (linkErr) throw linkErr
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.contacts', jobId] })
      form.reset(defaultValues)
      onOpenChange(false)
      success('Success', 'Contact added to job')
    },
    onError: (e: Error) => {
      toastError('Failed to add contact', e.message || 'Please try again.')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth={mode === 'new' ? '720px' : '520px'}
      >
        <Dialog.Title>Add contact</Dialog.Title>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <form.AppField name="mode">
                {(field) => (
                  <Field label="Type">
                    <SegmentedControl.Root
                      value={field.state.value}
                      onValueChange={(v) => {
                        field.handleChange(v as 'existing' | 'new')
                        form.setFieldValue('contactId', '')
                        form.setFieldValue('searchQuery', '')
                      }}
                    >
                      <SegmentedControl.Item value="existing">
                        Existing
                      </SegmentedControl.Item>
                      <SegmentedControl.Item value="new">
                        New
                      </SegmentedControl.Item>
                    </SegmentedControl.Root>
                  </Field>
                )}
              </form.AppField>

              <form.Subscribe selector={(state) => state.values.mode}>
                {(mode) =>
                  mode === 'existing' ? (
                    <form.AppField name="searchQuery">
                      {(field) => (
                        <Field label="Search contact">
                          <TextField.Root
                            value={field.state.value}
                            onChange={(e) => {
                              field.handleChange(e.target.value)
                              form.setFieldValue('contactId', '')
                            }}
                            placeholder="Search by name, email, or phone..."
                            autoFocus
                          />
                          {field.state.value.trim() &&
                            filteredContacts.length > 0 && (
                              <Box
                                mt="2"
                                style={{
                                  border: '1px solid var(--gray-a6)',
                                  borderRadius: 8,
                                  maxHeight: 200,
                                  overflowY: 'auto',
                                }}
                              >
                                {filteredContacts.map((c) => (
                                  <form.Subscribe
                                    key={c.id}
                                    selector={(state) => state.values.contactId}
                                  >
                                    {(contactId) => (
                                      <Box
                                        p="3"
                                        style={{
                                          cursor: 'pointer',
                                          backgroundColor:
                                            contactId === c.id
                                              ? 'var(--accent-a3)'
                                              : 'transparent',
                                        }}
                                        onClick={() => {
                                          form.setFieldValue('contactId', c.id)
                                          form.setFieldValue(
                                            'searchQuery',
                                            `${c.name}${c.email ? ` · ${c.email}` : ''}`,
                                          )
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor =
                                            'var(--gray-a3)'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor =
                                            contactId === c.id
                                              ? 'var(--accent-a3)'
                                              : 'transparent'
                                        }}
                                      >
                                        <Text
                                          size="2"
                                          weight={
                                            contactId === c.id
                                              ? 'medium'
                                              : 'regular'
                                          }
                                        >
                                          {c.name}
                                        </Text>
                                        {(c.email || c.title) && (
                                          <Text size="1" color="gray" mt="1">
                                            {c.email || ''}
                                            {c.email && c.title ? ' · ' : ''}
                                            {c.title || ''}
                                          </Text>
                                        )}
                                      </Box>
                                    )}
                                  </form.Subscribe>
                                ))}
                              </Box>
                            )}
                          {field.state.value.trim() &&
                            filteredContacts.length === 0 && (
                              <Text size="2" color="gray" mt="2">
                                No contacts found
                              </Text>
                            )}
                        </Field>
                      )}
                    </form.AppField>
                  ) : (
                    <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                      <form.AppField name="name">
                        {(field) => (
                          <field.TextField
                            label="Name *"
                            placeholder="Contact full name"
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="title">
                        {(field) => (
                          <field.TextField
                            label="Title / Role"
                            placeholder="e.g., Project Manager, CFO"
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="email">
                        {(field) => (
                          <field.TextField
                            label="Email"
                            placeholder="email@example.com"
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="phone">
                        {(field) => (
                          <Field label="Phone">
                            <PhoneInputField
                              id="contact-phone"
                              value={field.state.value}
                              onChange={(val) => field.handleChange(val ?? '')}
                              defaultCountry="NO"
                              placeholder="Enter phone number"
                            />
                          </Field>
                        )}
                      </form.AppField>
                      <form.AppField name="companyText">
                        {(field) => (
                          <field.TextField
                            label="Company"
                            placeholder="Scandic Bjørvika"
                            style={{ gridColumn: 'span 2' }}
                          />
                        )}
                      </form.AppField>
                    </Grid>
                  )
                }
              </form.Subscribe>

              <Separator my="2" />

              <form.AppField name="role">
                {(field) => (
                  <Field label="Role on job">
                    <TextField.Root
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="e.g., Venue contact, Site manager"
                    />
                    <Flex gap="2" wrap="wrap" mt="2">
                      <Text size="1" color="gray" style={{ width: '100%' }}>
                        Quick suggestions:
                      </Text>
                      {roleSuggestions.map((suggestion) => (
                        <Button
                          key={suggestion}
                          type="button"
                          size="1"
                          variant="soft"
                          color="gray"
                          onClick={() => field.handleChange(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </Flex>
                  </Field>
                )}
              </form.AppField>
              <form.AppField name="notes">
                {(field) => (
                  <field.TextArea
                    label="Notes"
                    rows={3}
                    placeholder="Additional information about this contact's role"
                  />
                )}
              </form.AppField>
            </Flex>

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
  )
}

export function EditContactDialog({
  open,
  onOpenChange,
  jobId,
  link,
  contact,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  link: { contact_id: UUID; role: string | null; notes: string | null }
  contact: {
    id: UUID
    name: string
    email: string | null
    phone: string | null
    title: string | null
    company_text: string | null
  }
}) {
  const qc = useQueryClient()
  const [role, setRole] = React.useState(link.role ?? '')
  const [notes, setNotes] = React.useState(link.notes ?? '')
  const [name, setName] = React.useState(contact.name)
  const [email, setEmail] = React.useState(contact.email ?? '')
  const [phone, setPhone] = React.useState(contact.phone ?? '')
  const [title, setTitle] = React.useState(contact.title ?? '')
  const [companyText, setCompanyText] = React.useState(
    contact.company_text ?? '',
  )

  React.useEffect(() => {
    if (!open) return
    setRole(link.role ?? '')
    setNotes(link.notes ?? '')
    setName(contact.name)
    setEmail(contact.email ?? '')
    setPhone(contact.phone ?? '')
    setTitle(contact.title ?? '')
    setCompanyText(contact.company_text ?? '')
  }, [open, link, contact])

  const save = useMutation({
    mutationFn: async () => {
      const [{ error: upLink }, { error: upContact }] = await Promise.all([
        supabase
          .from('job_contacts')
          .update({ role: role.trim() || null, notes: notes || null })
          .eq('job_id', jobId)
          .eq('contact_id', link.contact_id),
        supabase
          .from('contacts')
          .update({
            name: name.trim(),
            email: email || null,
            phone: phone || null,
            title: title || null,
            company_text: companyText || null,
          })
          .eq('id', contact.id),
      ])
      if (upLink) throw upLink
      if (upContact) throw upContact
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.contacts', jobId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>Edit contact</Dialog.Title>
        <Field label="Role on job">
          <TextField.Root
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Venue contact, Site manager"
          />
          <Flex gap="2" wrap="wrap" mt="2">
            <Text size="1" color="gray" style={{ width: '100%' }}>
              Quick suggestions:
            </Text>
            {roleSuggestions.map((suggestion) => (
              <Button
                key={suggestion}
                size="1"
                variant="soft"
                color="gray"
                onClick={() => setRole(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </Flex>
        </Field>
        <Field label="Notes">
          <TextArea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Separator my="2" />
        <Text size="2" color="gray">
          Contact details
        </Text>
        <Field label="Name">
          <TextField.Root
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <TextField.Root
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <TextField.Root
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Title">
          <TextField.Root
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Company">
          <TextField.Root
            value={companyText}
            onChange={(e) => setCompanyText(e.target.value)}
            placeholder="Scandic Bjørvika"
          />
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
  style,
}: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ marginTop: 10, ...style }}>
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
