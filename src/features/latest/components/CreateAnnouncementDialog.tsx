// src/features/latest/components/CreateAnnouncementDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { createAnnouncementMatter } from '@features/matters/api/queries'

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
  const [title, setTitle] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [forceEmailAll, setForceEmailAll] = React.useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return createAnnouncementMatter({
        companyId,
        title,
        message,
        forceEmailAll,
      })
    },
    onSuccess: async () => {
      setTitle('')
      setMessage('')
      await qc.invalidateQueries({ queryKey: ['matters'] })
      success(
        'Announcement sent',
        'Your announcement has been sent to everyone in the Matters inbox.',
      )
      onOpenChange(false)
    },
    onError: (err: any) => {
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
            This will be sent to every company member (owners, employees, admins,
            and freelancers). They will see it in their Matters inbox. Users who
            have enabled &quot;Announcements&quot; in their email preferences
            will also receive an email.
          </Text>
        </Box>

        <Flex mt="3" mb="3" align="center" gap="2">
          <Checkbox
            id="force-email-all"
            checked={forceEmailAll}
            onCheckedChange={(v) => setForceEmailAll(v === true)}
          />
          <Text as="label" size="2" htmlFor="force-email-all">
            Send email to everyone (override individual preferences)
          </Text>
        </Flex>

        <Flex direction="column" gap="3">
          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="medium">
              Title
            </Text>
            <TextField.Root
              placeholder="Announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Flex>

          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="medium">
              Message
            </Text>
            <TextArea
              placeholder="Write your announcement..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              style={{ resize: 'vertical' }}
            />
          </Flex>
        </Flex>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || !message.trim() || mutation.isPending}
            variant="solid"
          >
            {mutation.isPending ? 'Posting…' : 'Post Announcement'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
