import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Dialog, Flex } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { sendWelcomeEmailForPendingInvite } from '@shared/email/supabaseEdgeEmail'
import { addMemberOrInvite } from '@features/crew/api/queries'

type AddInviteResult =
  | { type: 'added' }
  | { type: 'invited'; pending_invite_id: string }
  | { type: 'already_invited'; by: string; pending_invite_id: string }
  | {
      type: 'already_member'
      role: 'owner' | 'employee' | 'freelancer' | 'super_user'
    }

const defaultValues = {
  email: '',
}

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
})

export default function AddEmployeeDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded?: () => void
}) {
  const { companyId } = useCompany()
  const { info, error, success } = useToast()

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await mut.mutateAsync(value.email.trim().toLowerCase())
    },
  })

  React.useEffect(() => {
    if (open) form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  const mut = useMutation<AddInviteResult, unknown, string>({
    mutationFn: async (email) => {
      if (!companyId) throw new Error('No company selected')
      return await addMemberOrInvite({
        companyId,
        email,
        role: 'employee',
      })
    },
    onSuccess: (res) => {
      const finish = () => {
        form.reset(defaultValues)
        onOpenChange(false)
        onAdded?.()
      }

      if (res.type === 'added') {
        info(
          'Employee added',
          'They already had an account and were added to your company.',
        )
        finish()
        return
      }
      if (res.type === 'already_member') {
        const nice =
          res.role === 'super_user' ? 'super user' : res.role.replace('_', ' ')
        info(
          'Already a member',
          `This user is already ${nice} in your company.`,
        )
        finish()
        return
      }

      if (res.type === 'invited') {
        success(
          'Invitation sent',
          'They’ll receive an email with a link to join. They’ll be added when they sign up.',
        )
        finish()
        return
      }

      void sendWelcomeEmailForPendingInvite(res.pending_invite_id)
        .then((emailRes) => {
          if (emailRes.ok) {
            success(
              'Invitation email sent',
              `We sent another invite link. A pending invite already exists (from ${res.by}).`,
            )
          } else {
            info(
              'Already invited',
              `An invite already exists (from ${res.by}). We could not resend the email just now.`,
            )
          }
        })
        .catch(() => {
          info(
            'Already invited',
            'An invite already exists. We could not resend the email just now.',
          )
        })
        .finally(() => {
          finish()
        })
    },
    onError: (e: unknown) => {
      error('Failed', e instanceof Error ? e.message : 'Please try again.')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Add employee</Dialog.Title>
        <Dialog.Description size="2">
          Enter the person’s email. If they already have an account, they’ll be
          added immediately as an <b>employee</b>. Otherwise we’ll email them an
          invitation link; they’ll appear as a pending invite (expires in 30
          days) until they join.
        </Dialog.Description>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <form.AppField name="email">
                {(field) => (
                  <field.TextField
                    label="Email"
                    type="email"
                    placeholder="employee@example.com"
                    autoComplete="email"
                  />
                )}
              </form.AppField>
            </Flex>

            <Flex gap="3" justify="end" mt="4">
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
