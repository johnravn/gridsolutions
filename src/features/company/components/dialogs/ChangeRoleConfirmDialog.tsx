import * as React from 'react'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {  setCompanyUserRole } from '../../api/queries'
import type {CompanyRole} from '../../api/queries';

export default function ChangeRoleConfirmDialog({
  open,
  onOpenChange,
  onChanged,
  userName,
  userEmail,
  currentRole,
  newRole,
  userId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged?: () => void
  userName: string
  userEmail: string
  currentRole: CompanyRole
  newRole: CompanyRole
  userId: string
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error } = useToast()

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return await setCompanyUserRole({ companyId, userId, role: newRole })
    },
    onSuccess: () => {
      // Refresh all crew-index lists since role might move the person between buckets
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'company' &&
          q.queryKey[1] === companyId &&
          q.queryKey[2] === 'crew-index',
      })
      success('Updated', 'Permissions updated')
      onOpenChange(false)
      onChanged?.()
    },
    onError: (e: any) => {
      error('Failed to update', e?.hint || e?.message || 'Please try again.')
    },
  })

  const capitalizeRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Change role</Dialog.Title>
        <Dialog.Description size="2">
          Are you sure you want to change{' '}
          <Text weight="medium">{userName}</Text>'s ({userEmail}) role from{' '}
          <Text weight="medium">{capitalizeRole(currentRole)}</Text> to{' '}
          <Text weight="medium">{capitalizeRole(newRole)}</Text>?
        </Dialog.Description>

        <Flex
          direction="column"
          gap="2"
          mt="4"
          p="3"
          style={{
            backgroundColor: 'var(--amber-3)',
            borderRadius: 'var(--radius-2)',
          }}
        >
          <Text size="2" weight="medium" style={{ color: 'var(--amber-11)' }}>
            ⚠️ Warning
          </Text>
          <Text size="2" style={{ color: 'var(--amber-11)' }}>
            This action will:
          </Text>
          <Text size="2" style={{ color: 'var(--amber-11)' }}>
            • Change their permissions and access level
          </Text>
          <Text size="2" style={{ color: 'var(--amber-11)' }}>
            • Affect what features they can use
          </Text>
          <Text size="2" style={{ color: 'var(--amber-11)' }}>
            • Update their role across the entire company
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
            color="amber"
            disabled={mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Updating…' : 'Change Role'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
