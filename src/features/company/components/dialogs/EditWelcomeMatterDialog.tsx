import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex, Separator, Text } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'

const WELCOME_MATTER_TITLE = 'Welcome to our company'

const GENERIC_WELCOME_MESSAGE = `Welcome to the team! We're excited to have you on board.

This platform will help you stay connected with the team, manage your work assignments, and access important company information.

If you have any questions or need help getting started, don't hesitate to reach out. We're here to support you!

Looking forward to working with you.`

const defaultValues = {
  title: WELCOME_MATTER_TITLE,
  content: GENERIC_WELCOME_MESSAGE,
}

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  content: z.string(),
})

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

  const { data: welcomeMatter, isLoading } = useQuery({
    queryKey: ['company', companyId, 'welcome-matter'],
    enabled: open && !!companyId,
    queryFn: async () => {
      if (!companyId) return null

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
            content: data.content ?? '',
          }
        : null
    },
  })

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await mut.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (welcomeMatter) {
      form.reset(
        {
          title: welcomeMatter.title,
          content: welcomeMatter.content,
        },
        { keepDefaultValues: true },
      )
    } else {
      form.reset(defaultValues, { keepDefaultValues: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, welcomeMatter?.id])

  const mut = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!companyId) throw new Error('No company selected')

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (welcomeMatter) {
        const { error: updateError } = await supabase
          .from('matters')
          .update({
            title: value.title.trim(),
            content: value.content.trim() || null,
          })
          .eq('id', welcomeMatter.id)
          .eq('company_id', companyId)

        if (updateError) throw updateError
      } else {
        const { data: newMatter, error: createError } = await supabase
          .from('matters')
          .insert({
            company_id: companyId,
            created_by_user_id: user.id,
            matter_type: 'announcement',
            title: value.title.trim(),
            content: value.content.trim() || null,
          })
          .select('id')
          .single()

        if (createError) throw createError

        if (newMatter?.id) {
          const { error: recipientsError } = await supabase.rpc(
            'add_existing_users_to_welcome_matter',
            {
              p_company_id: companyId,
              p_matter_id: newMatter.id,
            },
          )

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
    onError: (e: unknown) => {
      error(
        'Failed to save',
        e instanceof Error ? e.message : 'Please try again.',
      )
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
                {(field) => <field.TextField label="Title" />}
              </form.AppField>

              <Box>
                <Flex align="center" justify="between" mb="1">
                  <Text as="div" size="2" color="gray">
                    Content
                  </Text>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() =>
                      form.setFieldValue('content', GENERIC_WELCOME_MESSAGE)
                    }
                    type="button"
                  >
                    Use generic message
                  </Button>
                </Flex>
                <form.AppField name="content">
                  {(field) => (
                    <field.TextArea
                      rows={8}
                      placeholder="Welcome message content..."
                    />
                  )}
                </form.AppField>
              </Box>
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
