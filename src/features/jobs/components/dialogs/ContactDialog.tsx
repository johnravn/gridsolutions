import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  ScrollArea,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Check, Plus, Search } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import AddContactDialog from '@features/customers/components/dialogs/AddContactDialog'
import { prettyPhone } from '@shared/phone/phone'
import type { JobDetail, UUID } from '../../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: UUID
  job: JobDetail
  onSaved?: () => void
}

export default function ContactDialog({
  open,
  onOpenChange,
  companyId,
  job,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [search, setSearch] = React.useState('')
  const [selectedContactId, setSelectedContactId] = React.useState<UUID | null>(
    job.customer_contact_id ?? null,
  )
  const [addContactOpen, setAddContactOpen] = React.useState(false)

  const customerId = job.customer_id

  // Fetch contacts for the customer
  const { data: contacts = [], isFetching } = useQuery({
    queryKey: ['company', companyId, 'customer', customerId, 'contacts'],
    enabled: open && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, title')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .order('name', { ascending: true })
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

  // Filter contacts based on search
  const filteredContacts = React.useMemo(() => {
    if (!search.trim()) return contacts
    const query = search.toLowerCase().trim()
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query) ||
        c.title?.toLowerCase().includes(query),
    )
  }, [contacts, search])

  // Initialize selected contact when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedContactId(job.customer_contact_id ?? null)
      setSearch('')
    }
  }, [open, job.customer_contact_id])

  // Mutation to link contact to job
  const useContactMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContactId) throw new Error('Select a contact first')
      if (!job.id) throw new Error('Missing job id')

      const { error } = await supabase
        .from('jobs')
        .update({ customer_contact_id: selectedContactId })
        .eq('id', job.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'customer', customerId, 'contacts'],
        }),
        qc.invalidateQueries({ queryKey: ['jobs-detail', job.id] }),
        qc.invalidateQueries({ queryKey: ['jobs-index'], exact: false }),
      ])
      success('Contact set on job')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (e: any) => {
      toastError(
        'Failed to set contact on job',
        e?.message ?? 'Please try again.',
      )
    },
  })

  if (!customerId) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="600px">
          <Dialog.Title>Select contact</Dialog.Title>
          <Text color="gray" mt="3">
            Please select a customer for this job first.
          </Text>
          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="600px" style={{ height: 'auto' }}>
          <Dialog.Title>Select contact</Dialog.Title>

          <Flex direction="column" gap="3" mt="3">
            <TextField.Root
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="3"
            >
              <TextField.Slot side="left">
                <Search />
              </TextField.Slot>
              <TextField.Slot side="right">
                {isFetching && <Spinner />}
              </TextField.Slot>
            </TextField.Root>

            <Flex justify="between" align="center">
              <Text size="2" color="gray">
                {filteredContacts.length} contact
                {filteredContacts.length !== 1 ? 's' : ''}
              </Text>
              <Button
                variant="soft"
                size="2"
                onClick={() => setAddContactOpen(true)}
              >
                <Plus /> Add new contact
              </Button>
            </Flex>

            <ScrollArea
              type="auto"
              scrollbars="vertical"
              style={{ maxHeight: '400px' }}
            >
              <Flex direction="column" gap="1" p="1">
                {filteredContacts.length === 0 ? (
                  <Box p="3">
                    <Text color="gray">
                      {search.trim()
                        ? 'No contacts found matching your search.'
                        : 'No contacts found. Add one to get started.'}
                    </Text>
                  </Box>
                ) : (
                  filteredContacts.map((contact) => {
                    const isSelected = selectedContactId === contact.id
                    return (
                      <Box
                        key={contact.id}
                        p="3"
                        style={{
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected
                            ? 'var(--accent-a3)'
                            : undefined,
                          outline: isSelected
                            ? '2px solid var(--accent-9)'
                            : '1px solid var(--gray-5)',
                        }}
                        onClick={() => setSelectedContactId(contact.id)}
                      >
                        <Text weight="medium">{contact.name}</Text>
                        {(contact.email || contact.phone || contact.title) && (
                          <Flex direction="column" gap="1" mt="1">
                            {contact.title && (
                              <Text size="2" color="gray">
                                {contact.title}
                              </Text>
                            )}
                            {contact.email && (
                              <Text size="2" color="gray">
                                {contact.email}
                              </Text>
                            )}
                            {contact.phone && (
                              <Text size="2" color="gray">
                                {prettyPhone(contact.phone)}
                              </Text>
                            )}
                          </Flex>
                        )}
                      </Box>
                    )
                  })
                )}
              </Flex>
            </ScrollArea>
          </Flex>

          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="classic"
              disabled={!selectedContactId || useContactMutation.isPending}
              onClick={() => useContactMutation.mutate()}
            >
              {useContactMutation.isPending ? 'Saving…' : 'Use'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <AddContactDialog
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        companyId={companyId}
        customerId={customerId}
        onSaved={async () => {
          // Refresh contacts list
          await qc.invalidateQueries({
            queryKey: [
              'company',
              companyId,
              'customer',
              customerId,
              'contacts',
            ],
          })
        }}
      />
    </>
  )
}
