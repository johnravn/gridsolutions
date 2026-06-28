// src/features/super/components/AssignUserToCompanyDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Dialog, Flex, Select, Text } from '@radix-ui/themes'
import {
  SearchableSelect,
  preventDialogCloseOnSearchableSelect,
} from '@shared/ui/components/SearchableSelect'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { assignUserToCompany, companyUsersQuery } from '../api/queries'

type CompanyRole = 'owner' | 'employee' | 'freelancer' | 'super_user'

export default function AssignUserToCompanyDialog({
  open,
  onOpenChange,
  companyId,
  onAssigned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  onAssigned?: () => void
}) {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const dialogPortalRef = React.useRef<HTMLElement | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null,
  )
  const [selectedRole, setSelectedRole] =
    React.useState<CompanyRole>('employee')

  // Get existing company users to exclude them from selection
  const { data: existingUsers = [] } = useQuery({
    ...companyUsersQuery({ companyId }),
    enabled: open && !!companyId,
  })
  const existingUserIds = React.useMemo(
    () => new Set(existingUsers.map((u) => u.user_id)),
    [existingUsers],
  )

  // Search users
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['users', 'search', searchTerm, companyId],
    enabled: open && searchTerm.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, display_name, first_name, last_name')
        .or(
          `display_name.ilike.%${searchTerm.trim()}%,email.ilike.%${searchTerm.trim()}%,first_name.ilike.%${searchTerm.trim()}%,last_name.ilike.%${searchTerm.trim()}%`,
        )
        .limit(20)
        .order('email', { ascending: true })

      if (error) throw error

      // Filter out users already in company
      return data.filter((u) => !existingUserIds.has(u.user_id))
    },
    staleTime: 30_000,
  })

  const userOptions = React.useMemo(
    () =>
      searchResults.map((u) => ({
        value: u.user_id,
        label:
          u.display_name ||
          [u.first_name, u.last_name].filter(Boolean).join(' ') ||
          u.email,
        description: u.display_name ? u.email : undefined,
      })),
    [searchResults],
  )

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !companyId) {
        throw new Error('Please select a user')
      }
      return await assignUserToCompany({
        companyId,
        userId: selectedUserId,
        role: selectedRole,
      })
    },
    onSuccess: async () => {
      success('Success!', 'User assigned to company')
      setSearchTerm('')
      setSelectedUserId(null)
      setSelectedRole('employee')
      onOpenChange(false)
      await qc.invalidateQueries({
        queryKey: ['companies', companyId, 'users'],
      })
      await qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'company' &&
          q.queryKey[1] === companyId &&
          q.queryKey[2] === 'crew-index',
      })
      onAssigned?.()
    },
    onError: (e: any) => {
      toastError('Failed to assign user', e?.message ?? 'Please try again.')
    },
  })

  const canSubmit = !!selectedUserId && !!companyId && !!selectedRole

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="500px"
        onPointerDownOutside={preventDialogCloseOnSearchableSelect}
        onInteractOutside={preventDialogCloseOnSearchableSelect}
      >
        <Dialog.Title>Assign User to Company</Dialog.Title>

        <Box
          ref={(el: HTMLElement | null) => {
            dialogPortalRef.current = el
          }}
          style={{ position: 'relative' }}
        >
          <Flex direction="column" gap="3" mt="3">
            <div>
              <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
                Search for user
              </Text>
              <SearchableSelect
                options={userOptions}
                value={selectedUserId ?? ''}
                onValueChange={(v) => setSelectedUserId(v || null)}
                onInputChange={setSearchTerm}
                filterLocally={false}
                loading={searching}
                placeholder="Search by name or email…"
                emptyMessage="No users found (excluding users already in company)"
                disabled={assignMutation.isPending}
                portalContainer={() => dialogPortalRef.current}
                style={{ maxWidth: 'none' }}
              />
            </div>

            {selectedUserId && (
              <div>
                <Text
                  as="div"
                  size="2"
                  color="gray"
                  style={{ marginBottom: 6 }}
                >
                  Role
                </Text>
                <Select.Root
                  value={selectedRole}
                  onValueChange={(value) =>
                    setSelectedRole(value as CompanyRole)
                  }
                  disabled={assignMutation.isPending}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="owner">Owner</Select.Item>
                    <Select.Item value="employee">Employee</Select.Item>
                    <Select.Item value="freelancer">Freelancer</Select.Item>
                    <Select.Item value="super_user">Super User</Select.Item>
                  </Select.Content>
                </Select.Root>
                <Text size="1" color="gray" mt="1">
                  {selectedRole === 'owner' &&
                    'Full access to company settings and all resources'}
                  {selectedRole === 'employee' &&
                    'Access to most company resources, but not settings'}
                  {selectedRole === 'freelancer' &&
                    'Limited access to jobs and calendar'}
                  {selectedRole === 'super_user' &&
                    'Full access similar to owner'}
                </Text>
              </div>
            )}

            <Flex gap="3" justify="end" mt="4">
              <Dialog.Close>
                <Button
                  type="button"
                  variant="soft"
                  disabled={assignMutation.isPending}
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                onClick={() => assignMutation.mutate()}
                disabled={!canSubmit || assignMutation.isPending}
              >
                {assignMutation.isPending ? 'Assigning…' : 'Assign'}
              </Button>
            </Flex>
          </Flex>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  )
}
