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
import { supabase } from '@shared/api/supabase'
import { fuzzySearch } from '@shared/lib/generalFunctions'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { useToast } from '@shared/ui/toast/ToastProvider'
import type { UUID } from '../../types'

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
  const [mode, setMode] = React.useState<'existing' | 'new'>('existing')
  const [contactId, setContactId] = React.useState<UUID | ''>('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [role, setRole] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const roleSuggestions = [
    'Venue contact',
    'Site manager',
    'Technical support',
    'Supplier',
  ]

  // new contact fields
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [companyText, setCompanyText] = React.useState('')

  const { data: contacts = [] } = useQuery({
    queryKey: ['company', companyId, 'contacts', searchQuery],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('contacts')
        .select('id, name, email, phone, title')
        .eq('company_id', companyId)
        .order('name', { ascending: true })

      // Apply fuzzy search using multiple patterns
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

  // Apply client-side fuzzy filtering for better results
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
    mutationFn: async () => {
      let cid: UUID
      if (mode === 'existing') {
        if (!contactId) throw new Error('Pick a contact')
        cid = contactId
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            company_id: companyId,
            name: name.trim(),
            email: email || null,
            phone: phone || null,
            title: title || null,
            company_text: companyText || null,
          })
          .select('id')
          .single()
        if (error) throw error
        cid = data.id
      }
      const { error: linkErr } = await supabase.from('job_contacts').insert({
        job_id: jobId,
        contact_id: cid,
        role: role.trim() || null,
        notes: notes || null,
      })
      if (linkErr) throw linkErr
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.contacts', jobId] })
      onOpenChange(false)
      setContactId('')
      setSearchQuery('')
      setRole('')
      setNotes('')
      setName('')
      setEmail('')
      setPhone('')
      setTitle('')
      setCompanyText('')
      setMode('existing')
      success('Success', 'Contact added to job')
    },
    onError: (e: any) => {
      toastError('Failed to add contact', e?.message ?? 'Please try again.')
    },
  })

  const disabled =
    save.isPending || (mode === 'existing' ? !contactId : !name.trim())

  React.useEffect(() => {
    if (!open) {
      setMode('existing')
      setContactId('')
      setSearchQuery('')
      setRole('')
      setNotes('')
      setName('')
      setEmail('')
      setPhone('')
      setTitle('')
      setCompanyText('')
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth={mode === 'new' ? '720px' : '520px'}>
        <Dialog.Title>Add contact</Dialog.Title>

        <Flex direction="column" gap="3" mt="3">
          <Field label="Type">
            <SegmentedControl.Root
              value={mode}
              onValueChange={(v) => {
                setMode(v as 'existing' | 'new')
                setContactId('')
                setSearchQuery('')
              }}
            >
              <SegmentedControl.Item value="existing">
                Existing
              </SegmentedControl.Item>
              <SegmentedControl.Item value="new">New</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Field>

          {mode === 'existing' ? (
            <Field label="Search contact">
              <TextField.Root
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setContactId('')
                }}
                placeholder="Search by name, email, or phone..."
                autoFocus
              />
              {searchQuery.trim() && filteredContacts.length > 0 && (
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
                    <Box
                      key={c.id}
                      p="3"
                      style={{
                        cursor: 'pointer',
                        backgroundColor:
                          contactId === c.id
                            ? 'var(--accent-a3)'
                            : 'transparent',
                      }}
                      onClick={() => {
                        setContactId(c.id)
                        setSearchQuery(
                          `${c.name}${c.email ? ` · ${c.email}` : ''}`,
                        )
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--gray-a3)'
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
                        weight={contactId === c.id ? 'medium' : 'regular'}
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
                  ))}
                </Box>
              )}
              {searchQuery.trim() && filteredContacts.length === 0 && (
                <Text size="2" color="gray" mt="2">
                  No contacts found
                </Text>
              )}
            </Field>
          ) : (
            <Grid columns={{ initial: '1', sm: '2' }} gap="3">
              <Field label="Name *">
                <TextField.Root
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contact full name"
                  autoFocus
                />
              </Field>
              <Field label="Title / Role">
                <TextField.Root
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Project Manager, CFO"
                />
              </Field>
              <Field label="Email">
                <TextField.Root
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </Field>
              <Field label="Phone">
                <PhoneInputField
                  id="contact-phone"
                  value={phone}
                  onChange={(val) => setPhone(val ?? '')}
                  defaultCountry="NO"
                  placeholder="Enter phone number"
                />
              </Field>
              <Field label="Company" style={{ gridColumn: 'span 2' }}>
                <TextField.Root
                  value={companyText}
                  onChange={(e) => setCompanyText(e.target.value)}
                  placeholder="Scandic Bjørvika"
                />
              </Field>
            </Grid>
          )}

          <Separator my="2" />

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
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information about this contact's role"
            />
          </Field>
        </Flex>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={disabled}
          >
            {save.isPending ? 'Saving…' : 'Add'}
          </Button>
        </Flex>
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

  const roleSuggestions = [
    'Venue contact',
    'Site manager',
    'Technical support',
    'Supplier',
  ]

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
            variant="classic"
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
      <div style={{ color: 'var(--gray-11)', fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
