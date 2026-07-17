// src/features/latest/components/CreateAnnouncementDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { createAnnouncementMatter } from '@features/matters/api/queries'

const defaultValues = {
  title: '',
  message: '',
  forceEmailAll: false,
}

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  message: z.string().trim().min(1, 'Message is required'),
  forceEmailAll: z.boolean(),
})

export default function CreateAnnouncementDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (open) form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  const mutation = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!companyId) throw new Error('No company selected')
      return createAnnouncementMatter({
        companyId,
        title: value.title.trim(),
        message: value.message.trim(),
        forceEmailAll: value.forceEmailAll,
      })
    },
    onSuccess: async () => {
      form.reset(defaultValues)
      await qc.invalidateQueries({ queryKey: ['matters'] })
      success(
        'Announcement sent',
        'Your announcement has been sent to everyone in the Matters inbox.',
      )
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toastError('Failed to create announcement', err.message)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Create Announcement</Dialog.Title>

        <Box
          mb="3"
          p="3"
          style={{
            borderRadius: 8,
            backgroundColor: 'var(--gray-a2)',
          }}
        >
          <Text size="2" color="gray">
            This will be sent to every company member (owners, employees,
            admins, and freelancers). They will see it in their Matters inbox.
            Users who have enabled &quot;Announcements&quot; in their email
            preferences will also receive an email.
          </Text>
        </Box>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <form.AppField name="forceEmailAll">
              {(field) => (
                <Flex mt="3" mb="3" align="center" gap="2">
                  <field.Checkbox label="Send email to everyone (override individual preferences)" />
                </Flex>
              )}
            </form.AppField>

            <Flex direction="column" gap="3">
              <form.AppField name="title">
                {(field) => (
                  <field.TextField
                    label="Title"
                    placeholder="Announcement title"
                  />
                )}
              </form.AppField>

              <form.AppField name="message">
                {(field) => (
                  <field.TextArea
                    label="Message"
                    placeholder="Write your announcement..."
                    rows={6}
                    style={{ resize: 'vertical' }}
                  />
                )}
              </form.AppField>
            </Flex>

            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton
                label="Post Announcement"
                pendingLabel="Posting…"
              />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
