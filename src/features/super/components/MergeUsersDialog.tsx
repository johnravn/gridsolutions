import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Button,
  Flex,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { usersIndexQuery } from '../api/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected absorb user (the duplicate to remove). */
  absorbUserId: string | null
  absorbLabel?: string | null
}

export default function MergeUsersDialog({
  open,
  onOpenChange,
  absorbUserId,
  absorbLabel,
}: Props) {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const [keepUserId, setKeepUserId] = React.useState<string>('')
  const [confirmText, setConfirmText] = React.useState('')

  const { data: users = [] } = useQuery({
    ...usersIndexQuery(),
    enabled: open,
  })

  React.useEffect(() => {
    if (open) {
      setKeepUserId('')
      setConfirmText('')
    }
  }, [open, absorbUserId])

  const keepOptions = users.filter((u) => u.user_id !== absorbUserId)

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!absorbUserId || !keepUserId) {
        throw new Error('Select the account to keep')
      }
      const { error } = await supabase.rpc('merge_users', {
        p_keep_user_id: keepUserId,
        p_absorb_user_id: absorbUserId,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      onOpenChange(false)
      success(
        'Users merged',
        'Data and sign-in methods were moved to the kept account.',
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['users', 'detail'] }),
        qc.invalidateQueries({ queryKey: ['companies'] }),
        qc.invalidateQueries({ queryKey: ['company'] }),
      ])
    },
    onError: (e: Error) => {
      toastError('Merge failed', e.message ?? 'Please try again.')
    },
  })

  const canConfirm =
    !!keepUserId &&
    !!absorbUserId &&
    confirmText.trim().toUpperCase() === 'MERGE' &&
    !mergeMutation.isPending

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content maxWidth="480px">
        <AlertDialog.Title>Merge duplicate users</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Move all data and linked sign-in methods from the duplicate into the
          account you keep. The duplicate profile is permanently deleted. This
          cannot be undone.
        </AlertDialog.Description>

        <Flex direction="column" gap="3" mt="4">
          <Text size="2">
            <Text weight="bold">Absorb (remove): </Text>
            {absorbLabel ?? absorbUserId ?? '—'}
          </Text>

          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">
              Keep this account
            </Text>
            <Select.Root
              value={keepUserId || undefined}
              onValueChange={setKeepUserId}
            >
              <Select.Trigger placeholder="Select user to keep…" />
              <Select.Content>
                {keepOptions.map((u) => {
                  const label =
                    u.display_name ||
                    [u.first_name, u.last_name].filter(Boolean).join(' ') ||
                    u.email
                  return (
                    <Select.Item key={u.user_id} value={u.user_id}>
                      {label} ({u.email})
                    </Select.Item>
                  )
                })}
              </Select.Content>
            </Select.Root>
          </Flex>

          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">
              Type MERGE to confirm
            </Text>
            <TextField.Root
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="MERGE"
              autoComplete="off"
            />
          </Flex>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button
              variant="soft"
              color="gray"
              disabled={mergeMutation.isPending}
            >
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <Button
            color="red"
            disabled={!canConfirm}
            onClick={() => mergeMutation.mutate()}
          >
            {mergeMutation.isPending ? 'Merging…' : 'Merge users'}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  )
}
