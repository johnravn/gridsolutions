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
import { Plus, Search } from 'iconoir-react'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
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

const defaultValues = {
  search: '',
  selectedContactId: null as UUID | null,
}

const schema = z.object({
  search: z.string(),
  selectedContactId: z.string().min(1, 'Select a contact first'),
})

export default function ContactDialog({
  open,
  onOpenChange,
  companyId,
  job,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [addContactOpen, setAddContactOpen] = React.useState(false)

  const customerId = job.customer_id

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await useContactMutation.mutateAsync(value.selectedContactId as UUID)
    },
  })

  // Fetch contacts for the customer
  const { data: contacts = [], isFetching } = useQuery({
    queryKey: ['company', companyId, 'customer', customerId, 'contacts'],
    enabled: open && !!customerId,
    queryFn: async () => {
      if (!customerId) return []
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

  // Initialize selected contact when dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset(
        {
          search: '',
          selectedContactId: job.customer_contact_id ?? null,
        },
        { keepDefaultValues: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, job.customer_contact_id])

  // Mutation to link contact to job
  const useContactMutation = useMutation({
    mutationFn: async (selectedContactId: UUID) => {
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

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.AppForm>
              <Flex direction="column" gap="3" mt="3">
                <form.AppField name="search">
                  {(field) => (
                    <TextField.Root
                      placeholder="Search contacts…"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      size="3"
                    >
                      <TextField.Slot side="left">
                        <Search />
                      </TextField.Slot>
                      <TextField.Slot side="right">
                        {isFetching && <Spinner />}
                      </TextField.Slot>
                    </TextField.Root>
                  )}
                </form.AppField>

                <form.Subscribe
                  selector={(state) =>
                    [
                      state.values.search,
                      state.values.selectedContactId,
                    ] as const
                  }
                >
                  {([search, selectedContactId]) => {
                    const searchQuery = search ?? ''
                    const filteredContacts = (() => {
                      if (!searchQuery.trim()) return contacts
                      const query = searchQuery.toLowerCase().trim()
                      return contacts.filter(
                        (c) =>
                          c.name.toLowerCase().includes(query) ||
                          c.email?.toLowerCase().includes(query) ||
                          c.phone?.includes(query) ||
                          c.title?.toLowerCase().includes(query),
                      )
                    })()

                    return (
                      <>
                        <Flex justify="between" align="center">
                          <Text size="2" color="gray">
                            {filteredContacts.length} contact
                            {filteredContacts.length !== 1 ? 's' : ''}
                          </Text>
                          <Button
                            type="button"
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
                                const isSelected =
                                  selectedContactId === contact.id
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
                                    onClick={() =>
                                      form.setFieldValue(
                                        'selectedContactId',
                                        contact.id,
                                      )
                                    }
                                  >
                                    <Text weight="medium">{contact.name}</Text>
                                    {(contact.email ||
                                      contact.phone ||
                                      contact.title) && (
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
                      </>
                    )
                  }}
                </form.Subscribe>
              </Flex>

              <Flex justify="end" gap="2" mt="4">
                <Dialog.Close>
                  <Button type="button" variant="soft">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton label="Use" pendingLabel="Saving…" />
              </Flex>
            </form.AppForm>
          </form>
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
