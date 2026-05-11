import { AlertDialog, Button, Flex, Text } from '@radix-ui/themes'
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
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content maxWidth="460px">
        <AlertDialog.Title>Remove {userKind}</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Are you sure you want to remove{' '}
          <Text weight="medium">{userName}</Text> ({userEmail}) from this
          company?
        </AlertDialog.Description>

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
          <AlertDialog.Cancel>
            <Button type="button" variant="soft" disabled={mut.isPending}>
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button
              type="button"
              variant="solid"
              color="red"
              disabled={mut.isPending || !userId}
              onClick={() => {
                if (!userId || mut.isPending) return
                mut.mutate()
              }}
            >
              {mut.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  )
}
