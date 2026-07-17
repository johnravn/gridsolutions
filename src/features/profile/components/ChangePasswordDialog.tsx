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
import { z } from 'zod'
import { useAppForm } from '@shared/form'
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

const verifyDefaults = {
  currentPassword: '',
}

const changeDefaults = {
  newPassword: '',
  confirmPassword: '',
}

const verifySchema = z.object({
  currentPassword: z
    .string()
    .trim()
    .min(1, 'Please enter your current password.'),
})

const changeSchema = z
  .object({
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.newPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please enter a new password.',
        path: ['newPassword'],
      })
    } else if (
      !PASSWORD_REQUIREMENTS.every((req) => req.check(data.newPassword))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'New password does not meet all requirements.',
        path: ['newPassword'],
      })
    }
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'New passwords do not match.',
        path: ['confirmPassword'],
      })
    }
  })

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
  const [verifyError, setVerifyError] = React.useState<string | null>(null)

  const verifyForm = useAppForm({
    defaultValues: verifyDefaults,
    validators: {
      onSubmit: verifySchema,
    },
    onSubmit: async ({ value }) => {
      await verifyCurrentPasswordMutation.mutateAsync(
        value.currentPassword.trim(),
      )
    },
  })

  const changeForm = useAppForm({
    defaultValues: changeDefaults,
    validators: {
      onSubmit: changeSchema,
    },
    onSubmit: async ({ value }) => {
      await changePasswordMutation.mutateAsync(value.newPassword)
    },
  })

  React.useEffect(() => {
    if (open) {
      setStep('verify')
      setVerifyError(null)
      verifyForm.reset(verifyDefaults)
      changeForm.reset(changeDefaults)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  const verifyCurrentPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      })
      if (error) throw new Error('Current password is incorrect.')
    },
    onSuccess: () => {
      setVerifyError(null)
      setStep('new')
    },
    onError: () => {
      setVerifyError('Current password is incorrect.')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (newPwd: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
    },
    onSuccess: () => {
      onOpenChange(false)
      setStep('verify')
      verifyForm.reset(verifyDefaults)
      changeForm.reset(changeDefaults)
      success(
        'Password changed',
        'Your password has been updated successfully.',
      )
    },
    onError: (e: Error) => {
      toastError('Password change failed', e?.message ?? 'Please try again.')
    },
  })

  const verifyLoading = verifyCurrentPasswordMutation.isPending
  const changeLoading = changePasswordMutation.isPending

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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setVerifyError(null)
              void verifyForm.handleSubmit()
            }}
          >
            <verifyForm.AppForm>
              <Flex direction="column" gap="4" mt="4">
                {verifyError && (
                  <Text size="2" color="red">
                    {verifyError}
                  </Text>
                )}

                <verifyForm.AppField name="currentPassword">
                  {(field) => (
                    <Flex direction="column" gap="2">
                      <Text size="2" weight="medium">
                        Current password
                      </Text>
                      <TextField.Root
                        type="password"
                        value={field.state.value}
                        onChange={(e) => {
                          field.handleChange(e.target.value)
                          setVerifyError(null)
                        }}
                        onBlur={field.handleBlur}
                        placeholder="Enter current password"
                        disabled={verifyLoading}
                        autoComplete="current-password"
                        color={verifyError ? 'red' : undefined}
                      />
                    </Flex>
                  )}
                </verifyForm.AppField>

                <Flex gap="3" justify="end" mt="2">
                  <Dialog.Close>
                    <Button
                      type="button"
                      variant="soft"
                      disabled={verifyLoading}
                    >
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <verifyForm.SubmitButton
                    label="Continue"
                    pendingLabel="Verifying…"
                  />
                </Flex>
              </Flex>
            </verifyForm.AppForm>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void changeForm.handleSubmit()
            }}
          >
            <changeForm.AppForm>
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
                    changeForm.reset(changeDefaults)
                  }}
                  disabled={changeLoading}
                >
                  Use a different current password
                </Button>

                <changeForm.AppField name="newPassword">
                  {(field) => {
                    const passwordRequirements = PASSWORD_REQUIREMENTS.map(
                      (req) => ({
                        ...req,
                        satisfied: req.check(field.state.value),
                      }),
                    )
                    return (
                      <Flex direction="column" gap="2">
                        <Text size="2" weight="medium">
                          New password
                        </Text>
                        <TextField.Root
                          type="password"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="Enter new password"
                          disabled={changeLoading}
                          autoComplete="new-password"
                        />
                        {field.state.value && (
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
                    )
                  }}
                </changeForm.AppField>

                <changeForm.Subscribe
                  selector={(state) => state.values.newPassword}
                >
                  {(newPassword) => (
                    <changeForm.AppField name="confirmPassword">
                      {(field) => {
                        const passwordsMatch =
                          !newPassword || !field.state.value
                            ? null
                            : newPassword === field.state.value
                        return (
                          <Flex direction="column" gap="2">
                            <Text size="2" weight="medium">
                              Confirm new password
                            </Text>
                            <TextField.Root
                              type="password"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              onBlur={field.handleBlur}
                              placeholder="Confirm new password"
                              disabled={changeLoading}
                              autoComplete="new-password"
                              color={
                                field.state.value && passwordsMatch === false
                                  ? 'red'
                                  : undefined
                              }
                            />
                            {field.state.value && (
                              <Flex align="center" gap="2" mt="1">
                                {passwordsMatch ? (
                                  <>
                                    <CheckCircle
                                      width={18}
                                      height={18}
                                      style={{ color: 'var(--green-11)' }}
                                    />
                                    <Text
                                      size="2"
                                      style={{ color: 'var(--green-11)' }}
                                    >
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
                        )
                      }}
                    </changeForm.AppField>
                  )}
                </changeForm.Subscribe>

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
                  <changeForm.Subscribe
                    selector={(state) => [
                      state.values.newPassword,
                      state.values.confirmPassword,
                    ]}
                  >
                    {([newPassword, confirmPassword]) => {
                      const allRequirementsSatisfied =
                        PASSWORD_REQUIREMENTS.every((req) =>
                          req.check(newPassword),
                        )
                      return (
                        <changeForm.SubmitButton
                          label="Change password"
                          pendingLabel="Changing…"
                          disabled={
                            !allRequirementsSatisfied ||
                            newPassword !== confirmPassword
                          }
                        />
                      )
                    }}
                  </changeForm.Subscribe>
                </Flex>
              </Flex>
            </changeForm.AppForm>
          </form>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
