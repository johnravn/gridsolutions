import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { sendWelcomeEmailForPendingInvite } from '@shared/email/supabaseEdgeEmail'
import { addMemberOrInvite } from '../../api/queries'

type AddInviteResult =
  | { type: 'added' }
  | { type: 'invited'; pending_invite_id: string }
  | { type: 'already_invited'; by: string; pending_invite_id: string }
  | {
      type: 'already_member'
      role: 'owner' | 'employee' | 'freelancer' | 'super_user'
    }

export default function AddFreelancerDialog({
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
  const [email, setEmail] = React.useState('')

  const normalized = email.trim().toLowerCase()
  const canSubmit =
    !!companyId && !!normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)

  const mut = useMutation<AddInviteResult, unknown, void>({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return await addMemberOrInvite({
        companyId,
        email: normalized,
        role: 'freelancer',
      })
    },
    onSuccess: (res) => {
      const finish = () => {
        setEmail('')
        onOpenChange(false)
        onAdded?.()
      }

      if (res.type === 'added') {
        info(
          'Freelancer added',
          'They already had an account and were added to your company.',
        )
        finish()
        return
      }
      if (res.type === 'already_member') {
        info('Already a member', `This user is already in your crew.`)
        finish()
        return
      }

      if (res.type === 'invited') {
        // New row: trg_pending_invites_send_welcome_email already calls send-welcome-email via pg_net.
        success(
          'Invitation sent',
          'They’ll receive an email with a link to join. They’ll be added when they sign up.',
        )
        finish()
        return
      }

      // already_invited: no new INSERT, so the DB trigger does not run — resend from the client.
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
    onError: (e: any) => {
      error('Failed', e?.message ?? 'Please try again.')
    },
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || mut.isPending) return
    mut.mutate()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Add freelancer</Dialog.Title>
        <Dialog.Description size="2">
          Enter the person’s email. If they already have an account, they’ll be
          added immediately. Otherwise we’ll email them an invitation link; they’ll
          appear as a pending invite (expires in 30 days) until they join.
        </Dialog.Description>

        <form onSubmit={onSubmit}>
          <Flex direction="column" gap="3" mt="3">
            <label>
              <Text size="2">Email</Text>
              <TextField.Root
                type="email"
                required
                placeholder="freelancer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </label>
          </Flex>

          <Flex gap="3" justify="end" mt="4">
            <Dialog.Close>
              <Button type="button" variant="soft" disabled={mut.isPending}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={!canSubmit || mut.isPending}>
              {mut.isPending ? 'Saving…' : 'Add'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
