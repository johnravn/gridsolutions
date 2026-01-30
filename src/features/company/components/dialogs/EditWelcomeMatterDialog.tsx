import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'

const WELCOME_MATTER_TITLE = 'Welcome to our company'

const GENERIC_WELCOME_MESSAGE = `Welcome to the team! We're excited to have you on board.

This platform will help you stay connected with the team, manage your work assignments, and access important company information.

If you have any questions or need help getting started, don't hesitate to reach out. We're here to support you!

Looking forward to working with you.`

export default function EditWelcomeMatterDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error } = useToast()

  // Load or create welcome matter
  const { data: welcomeMatter, isLoading } = useQuery({
    queryKey: ['company', companyId, 'welcome-matter'],
    enabled: open && !!companyId,
    queryFn: async () => {
      if (!companyId) return null

      // Try to find existing welcome matter
      const { data, error: findError } = await supabase
        .from('matters')
        .select('id, title, content')
        .eq('company_id', companyId)
        .eq('title', WELCOME_MATTER_TITLE)
        .eq('matter_type', 'announcement')
        .maybeSingle()

      if (findError && findError.code !== 'PGRST116') throw findError

      return data
        ? {
            id: data.id,
            title: data.title,
            content: (data.content) ?? '',
          }
        : null
    },
  })

  const [form, setForm] = React.useState({
    title: WELCOME_MATTER_TITLE,
    content: GENERIC_WELCOME_MESSAGE,
  })

  React.useEffect(() => {
    if (welcomeMatter) {
      setForm({
        title: welcomeMatter.title,
        content: welcomeMatter.content,
      })
    } else {
      setForm({
        title: WELCOME_MATTER_TITLE,
        content: GENERIC_WELCOME_MESSAGE,
      })
    }
  }, [welcomeMatter?.id])

  const set = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }))

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (welcomeMatter) {
        // Update existing matter
        const { error: updateError } = await supabase
          .from('matters')
          .update({
            title: form.title.trim(),
            content: form.content.trim() || null,
          })
          .eq('id', welcomeMatter.id)
          .eq('company_id', companyId)

        if (updateError) throw updateError
      } else {
        // Create new welcome matter
        const { data: newMatter, error: createError } = await supabase
          .from('matters')
          .insert({
            company_id: companyId,
            created_by_user_id: user.id,
            matter_type: 'announcement',
            title: form.title.trim(),
            content: form.content.trim() || null,
          })
          .select('id')
          .single()

        if (createError) throw createError

        // Add all existing company members as recipients to the welcome matter
        // This handles the case where the welcome matter is created after users already exist
        if (newMatter?.id) {
          const { error: recipientsError } = await supabase.rpc(
            'add_existing_users_to_welcome_matter',
            {
              p_company_id: companyId,
              p_matter_id: newMatter.id,
            },
          )

          // Don't fail the whole operation if adding recipients fails (they'll be added via trigger for new users)
          if (recipientsError) {
            console.warn(
              'Failed to add existing users to welcome matter:',
              recipientsError,
            )
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'welcome-matter'],
      })
      onOpenChange(false)
      onSaved?.()
      success('Success', 'Welcome matter saved')
    },
    onError: (e: any) => {
      error('Failed to save', e?.message ?? 'Please try again.')
    },
  })

  if (isLoading)
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>Edit welcome matter</Dialog.Title>
          <Flex align="center" gap="2" p="4">
            <Text>Loading…</Text>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="520px"
        style={{ maxHeight: '90vh', overflow: 'auto' }}
      >
        <Dialog.Title>Edit welcome matter</Dialog.Title>
        <Text as="div" size="1" color="gray" mb="3">
          This message will be sent to all users when they are added to this
          company
        </Text>

        <Separator size="4" mb="3" />

        <Flex direction="column" gap="3">
          <Field label="Title">
            <TextField.Root
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
            />
          </Field>

          <Box>
            <Flex align="center" justify="between" mb="1">
              <Text as="div" size="2" color="gray">
                Content
              </Text>
              <Button
                size="1"
                variant="soft"
                onClick={() => set('content', GENERIC_WELCOME_MESSAGE)}
                type="button"
              >
                Use generic message
              </Button>
            </Flex>
            <TextArea
              rows={8}
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="Welcome message content..."
            />
          </Box>
        </Flex>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={() => mut.mutate()}
            disabled={!form.title.trim() || mut.isPending}
          >
            {mut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Flex>
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
    <div>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}
