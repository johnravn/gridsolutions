import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
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
  const { info, error } = useToast()
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
      if (res.type === 'added') {
        info(
          'Freelancer added',
          'They already had an account and were added to your company.',
        )
      } else if (res.type === 'invited') {
        // Don’t rely on pg_net/vault being configured in dev; explicitly invoke the welcome email.
        supabase.functions
          .invoke('send-welcome-email', {
            body: { pending_invite_id: res.pending_invite_id },
          })
          .catch(() => {})
        info(
          'Invite created',
          'They will be added automatically when they sign up.',
        )
      } else if (res.type === 'already_invited') {
        // If emails were previously not being dispatched, re-invoke to ensure the invite email is sent.
        supabase.functions
          .invoke('send-welcome-email', {
            body: { pending_invite_id: res.pending_invite_id },
          })
          .catch(() => {})
        info('Already invited', `An invite already exists by ${res.by}.`)
      } else {
        info('Already a member', `This user is already in your crew.`)
      }
      setEmail('')
      onOpenChange(false) // only close on success
      onAdded?.()
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
          added immediately. Otherwise, they’ll appear as a pending invite
          (expires in 30 days).
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
