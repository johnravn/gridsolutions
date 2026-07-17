import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { updateContact } from '../../api/queries'
import type { ContactRow } from '../../api/queries'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  contact: ContactRow | null
  onSaved?: () => void
}

const emptyValues = {
  name: '',
  email: '',
  phone: '',
  title: '',
  notes: '',
}

function buildDefaults(contact: ContactRow | null) {
  if (!contact) return emptyValues
  return {
    name: contact.name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    title: contact.title ?? '',
    notes: contact.notes ?? '',
  }
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string(),
  phone: z.string(),
  title: z.string(),
  notes: z.string(),
})

export default function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
}: Props) {
  const { success } = useToast()

  const form = useAppForm({
    defaultValues: buildDefaults(contact),
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await mut.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!open || !contact) return
    form.reset(buildDefaults(contact), { keepDefaultValues: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens or contact changes
  }, [open, contact?.id])

  const mut = useMutation({
    mutationFn: async (value: ReturnType<typeof buildDefaults>) =>
      updateContact({
        id: contact!.id,
        name: value.name.trim(),
        email: value.email.trim() || null,
        phone: value.phone.trim() || null,
        title: value.title.trim() || null,
        notes: value.notes.trim() || null,
      }),
    onSuccess: () => {
      onOpenChange(false)
      onSaved?.()
      success('Success', 'Contact info saved')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Edit contact</Dialog.Title>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <form.AppField name="name">
                {(field) => <field.TextField label="Name *" />}
              </form.AppField>
              <Flex gap="3" wrap="wrap">
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      label="Email"
                      type="email"
                      style={{ flex: '1 1', minWidth: 220 }}
                    />
                  )}
                </form.AppField>
                <form.AppField name="phone">
                  {(field) => (
                    <Flex
                      direction="column"
                      gap="1"
                      style={{ flex: '1 1', minWidth: 220 }}
                    >
                      <Text as="label" size="2" weight="medium">
                        Phone
                      </Text>
                      <PhoneInputField
                        id="signup-phone"
                        value={field.state.value}
                        onChange={(val) => field.handleChange(val ?? '')}
                        defaultCountry="NO"
                        placeholder="Enter phone number"
                      />
                    </Flex>
                  )}
                </form.AppField>
              </Flex>
              <form.AppField name="title">
                {(field) => <field.TextField label="Title / Role" />}
              </form.AppField>
              <form.AppField name="notes">
                {(field) => <field.TextArea label="Notes" rows={3} />}
              </form.AppField>
            </Flex>

            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton label="Save" pendingLabel="Saving…" />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
