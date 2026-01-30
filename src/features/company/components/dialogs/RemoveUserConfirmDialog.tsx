import * as React from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { removeCompanyUser } from '../../api/queries'

export default function RemoveUserConfirmDialog({
  open,
  onOpenChange,
  onRemoved,
  userName,
  userEmail,
  userKind,
  userId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onRemoved?: () => void
  userName: string
  userEmail: string
  userKind: 'employee' | 'freelancer'
  userId: string
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error } = useToast()

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return await removeCompanyUser({ companyId, userId })
    },
    onSuccess: () => {
      // Refresh all crew-index lists since user was removed
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'company' &&
          q.queryKey[1] === companyId &&
          q.queryKey[2] === 'crew-index',
      })
      success('User removed', `${userName} has been removed from the company.`)
      onOpenChange(false)
      onRemoved?.()
    },
    onError: (e: any) => {
      error('Failed to remove user', e?.message ?? 'Please try again.')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Remove {userKind}</Dialog.Title>
        <Dialog.Description size="2">
          Are you sure you want to remove{' '}
          <Text weight="medium">{userName}</Text> ({userEmail}) from this
          company?
        </Dialog.Description>

        <Flex
          direction="column"
          gap="2"
          mt="4"
          p="3"
          style={{
            backgroundColor: 'var(--red-3)',
            borderRadius: 'var(--radius-2)',
          }}
        >
          <Text size="2" weight="medium" style={{ color: 'var(--red-11)' }}>
            ⚠️ Warning
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            This action will:
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Remove all access to company data and features
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Remove them from all company-related activities
          </Text>
          <Text size="2" style={{ color: 'var(--red-11)' }}>
            • Not delete their user account
          </Text>
        </Flex>

        <Flex gap="3" justify="end" mt="4">
          <Dialog.Close>
            <Button type="button" variant="soft" disabled={mut.isPending}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            type="button"
            variant="solid"
            color="red"
            disabled={mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
