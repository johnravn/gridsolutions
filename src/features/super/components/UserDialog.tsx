// src/features/super/components/UserDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Checkbox,
  Dialog,
  Flex,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'

type FormState = {
  email: string
  display_name: string
  first_name: string
  last_name: string
  phone: string
  superuser: boolean
}

type EditInitialData = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  superuser: boolean
}

export default function UserDialog({
  open,
  onOpenChange,
  initialData,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialData?: EditInitialData
  onSaved?: () => void
}) {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()

  const [form, setForm] = React.useState<FormState>({
    email: '',
    display_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    superuser: false,
  })

  const set = <TKey extends keyof FormState>(
    key: TKey,
    value: FormState[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  // Prefill form on edit
  React.useEffect(() => {
    if (!open) {
      setForm({
        email: '',
        display_name: '',
        first_name: '',
        last_name: '',
        phone: '',
        superuser: false,
      })
      return
    }

    if (initialData) {
      setForm({
        email: initialData.email || '',
        display_name: initialData.display_name || '',
        first_name: initialData.first_name || '',
        last_name: initialData.last_name || '',
        phone: initialData.phone || '',
        superuser: initialData.superuser || false,
      })
    }
  }, [open, initialData])

  const editMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!initialData?.user_id) throw new Error('Missing user id')

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: f.display_name.trim() || null,
          first_name: f.first_name.trim() || null,
          last_name: f.last_name.trim() || null,
          phone: f.phone.trim() || null,
          superuser: f.superuser,
        })
        .eq('user_id', initialData.user_id)

      if (error) throw error
    },
    onSuccess: () => {
      onOpenChange(false)
      success('Success!', 'User was updated')
      onSaved?.()
      void Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({
          queryKey: ['users', 'detail', initialData!.user_id],
        }),
      ])
    },
    onError: (e: any) => {
      toastError('Failed to update user', e?.message ?? 'Please try again.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initialData?.user_id) throw new Error('Missing user id')

      // Note: We're only deleting from profiles, not from auth.users
      // In production, you'd want to delete from auth.users as well via Admin API
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', initialData.user_id)

      if (error) throw error
    },
    onSuccess: () => {
      onOpenChange(false)
      success('Success!', 'User was deleted')
      onSaved?.()
      void qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e: any) => {
      toastError('Failed to delete user', e?.message ?? 'Please try again.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    editMutation.mutate(form)
  }

  const isLoading = editMutation.isPending || deleteMutation.isPending

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Edit User</Dialog.Title>

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4" mt="4">
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Email <Text color="red">*</Text>
              </Text>
              <TextField.Root
                value={form.email}
                disabled={true}
                placeholder="user@example.com"
              />
              <Text size="1" color="gray">
                Email cannot be changed
              </Text>
            </Flex>

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Display Name
              </Text>
              <TextField.Root
                value={form.display_name}
                onChange={(e) => set('display_name', e.target.value)}
                placeholder="Display name"
                disabled={isLoading}
              />
            </Flex>

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                First Name
              </Text>
              <TextField.Root
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                placeholder="First name"
                disabled={isLoading}
              />
            </Flex>

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Last Name
              </Text>
              <TextField.Root
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                placeholder="Last name"
                disabled={isLoading}
              />
            </Flex>

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Phone
              </Text>
              <TextField.Root
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="Phone number"
                disabled={isLoading}
              />
            </Flex>

            <Flex gap="3" align="center">
              <Checkbox
                checked={form.superuser}
                onCheckedChange={(checked) =>
                  set('superuser', checked === true)
                }
                disabled={isLoading}
              />
              <Text size="2" weight="medium">
                Superuser
              </Text>
            </Flex>

            <Flex gap="3" justify="end" mt="4">
              <Dialog.Close>
                <Button type="button" variant="soft" disabled={isLoading}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="soft"
                color="red"
                onClick={(e) => {
                  e.preventDefault()
                  if (
                    confirm(
                      `Are you sure you want to delete ${initialData?.email}? This action cannot be undone.`,
                    )
                  ) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={isLoading}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete User'}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving…' : 'Save'}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
