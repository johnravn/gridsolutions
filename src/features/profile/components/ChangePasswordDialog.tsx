// src/features/profile/components/ChangePasswordDialog.tsx
import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Text,
  TextField,
} from '@radix-ui/themes'
import { CheckCircle } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'

interface PasswordRequirement {
  id: string
  label: string
  check: (password: string) => boolean
}

const PASSWORD_REQUIREMENTS: Array<PasswordRequirement> = [
  {
    id: 'length',
    label: 'At least 12 characters',
    check: (pwd) => pwd.length >= 12,
  },
  {
    id: 'lowercase',
    label: 'Contains lowercase letter',
    check: (pwd) => /[a-z]/.test(pwd),
  },
  {
    id: 'uppercase',
    label: 'Contains uppercase letter',
    check: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    id: 'number',
    label: 'Contains number',
    check: (pwd) => /[0-9]/.test(pwd),
  },
  {
    id: 'special',
    label: 'Contains special character (!@#$%^&*...)',
    check: (pwd) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
  },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail: string
}

export default function ChangePasswordDialog({
  open,
  onOpenChange,
  userEmail,
}: Props) {
  const { success, error: toastError } = useToast()
  const [step, setStep] = React.useState<'verify' | 'new'>('verify')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [currentPasswordError, setCurrentPasswordError] = React.useState<
    string | null
  >(null)
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [clientError, setClientError] = React.useState<string | null>(null)

  const resetForm = React.useCallback(() => {
    setStep('verify')
    setCurrentPassword('')
    setCurrentPasswordError(null)
    setNewPassword('')
    setConfirmPassword('')
    setClientError(null)
  }, [])

  React.useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  const passwordRequirements = React.useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      satisfied: req.check(newPassword),
    }))
  }, [newPassword])

  const allRequirementsSatisfied = React.useMemo(
    () => passwordRequirements.every((r) => r.satisfied),
    [passwordRequirements],
  )

  const passwordsMatch = React.useMemo(() => {
    if (!newPassword || !confirmPassword) return null
    return newPassword === confirmPassword
  }, [newPassword, confirmPassword])

  const verifyCurrentPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      })
      if (error) throw new Error('Current password is incorrect.')
    },
    onSuccess: () => {
      setCurrentPasswordError(null)
      setStep('new')
    },
    onError: () => {
      setCurrentPasswordError('Current password is incorrect.')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (newPwd: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
    },
    onSuccess: () => {
      onOpenChange(false)
      resetForm()
      success('Password changed', 'Your password has been updated successfully.')
    },
    onError: (e: Error) => {
      toastError('Password change failed', e?.message ?? 'Please try again.')
    },
  })

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPasswordError(null)
    const trimmed = currentPassword.trim()
    if (!trimmed) {
      setCurrentPasswordError('Please enter your current password.')
      return
    }
    verifyCurrentPasswordMutation.mutate(trimmed)
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setClientError(null)

    if (!newPassword) {
      setClientError('Please enter a new password.')
      return
    }
    if (!allRequirementsSatisfied) {
      setClientError('New password does not meet all requirements.')
      return
    }
    if (newPassword !== confirmPassword) {
      setClientError('New passwords do not match.')
      return
    }

    changePasswordMutation.mutate(newPassword)
  }

  const verifyLoading = verifyCurrentPasswordMutation.isPending
  const changeLoading = changePasswordMutation.isPending
  const isLoading = verifyLoading || changeLoading

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>Change password</Dialog.Title>
        <Dialog.Description size="2">
          {step === 'verify'
            ? 'Enter your current password to continue.'
            : 'Choose a new password that meets the requirements below.'}
        </Dialog.Description>

        {step === 'verify' ? (
          <form onSubmit={handleVerify}>
            <Flex direction="column" gap="4" mt="4">
              {currentPasswordError && (
                <Text size="2" color="red">
                  {currentPasswordError}
                </Text>
              )}

              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  Current password
                </Text>
                <TextField.Root
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value)
                    setCurrentPasswordError(null)
                  }}
                  placeholder="Enter current password"
                  disabled={verifyLoading}
                  autoComplete="current-password"
                  color={currentPasswordError ? 'red' : undefined}
                />
              </Flex>

              <Flex gap="3" justify="end" mt="2">
                <Dialog.Close>
                  <Button type="button" variant="soft" disabled={verifyLoading}>
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" disabled={verifyLoading}>
                  {verifyLoading ? 'Verifying…' : 'Continue'}
                </Button>
              </Flex>
            </Flex>
          </form>
        ) : (
          <form onSubmit={handleChangePassword}>
            <Flex direction="column" gap="4" mt="4">
              <Flex
                align="center"
                gap="2"
                style={{
                  padding: '8px 12px',
                  background: 'var(--green-2)',
                  borderRadius: '6px',
                  color: 'var(--green-11)',
                }}
              >
                <CheckCircle width={18} height={18} />
                <Text size="2" weight="medium">
                  Current password verified
                </Text>
              </Flex>

              <Button
                type="button"
                variant="ghost"
                size="1"
                color="gray"
                onClick={() => {
                  setStep('verify')
                  setNewPassword('')
                  setConfirmPassword('')
                  setClientError(null)
                }}
                disabled={changeLoading}
              >
                Use a different current password
              </Button>

              {clientError && (
                <Text size="2" color="red">
                  {clientError}
                </Text>
              )}

              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  New password
                </Text>
                <TextField.Root
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={changeLoading}
                  autoComplete="new-password"
                />
                {newPassword && (
                  <Box
                    mt="2"
                    style={{
                      padding: '12px',
                      background: 'var(--gray-2)',
                      borderRadius: '6px',
                    }}
                  >
                    <Text
                      size="2"
                      weight="medium"
                      mb="2"
                      style={{ display: 'block' }}
                    >
                      Password requirements:
                    </Text>
                    <Flex direction="column" gap="1">
                      {passwordRequirements.map((req) => (
                        <Flex key={req.id} align="center" gap="2">
                          <Checkbox checked={req.satisfied} disabled />
                          <Text
                            size="2"
                            style={{
                              color: req.satisfied
                                ? 'var(--green-11)'
                                : 'var(--gray-11)',
                              textDecoration: req.satisfied
                                ? 'line-through'
                                : 'none',
                            }}
                          >
                            {req.label}
                          </Text>
                        </Flex>
                      ))}
                    </Flex>
                  </Box>
                )}
              </Flex>

              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  Confirm new password
                </Text>
                <TextField.Root
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={changeLoading}
                  autoComplete="new-password"
                  color={
                    confirmPassword && !passwordsMatch ? 'red' : undefined
                  }
                />
                {confirmPassword && (
                  <Flex align="center" gap="2" mt="1">
                    {passwordsMatch ? (
                      <>
                        <CheckCircle
                          width={18}
                          height={18}
                          style={{ color: 'var(--green-11)' }}
                        />
                        <Text size="2" style={{ color: 'var(--green-11)' }}>
                          Passwords match
                        </Text>
                      </>
                    ) : (
                      <Text size="2" color="red">
                        Passwords do not match
                      </Text>
                    )}
                  </Flex>
                )}
              </Flex>

              <Flex gap="3" justify="end" mt="2">
                <Dialog.Close>
                  <Button
                    type="button"
                    variant="soft"
                    disabled={changeLoading}
                  >
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button
                  type="submit"
                  disabled={
                    changeLoading ||
                    !allRequirementsSatisfied ||
                    newPassword !== confirmPassword
                  }
                >
                  {changeLoading ? 'Changing…' : 'Change password'}
                </Button>
              </Flex>
            </Flex>
          </form>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
