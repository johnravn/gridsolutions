// src/features/login/pages/SignupPage.tsx
import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { isValidPhoneNumber } from 'react-phone-number-input' // ✅ add this
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { PhoneInputField } from '@shared/phone/PhoneInputField' // ✅ add this
import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { AnimatedBackground } from '@shared/ui/components/AnimatedBackground'

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

const defaultValues = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
}

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    phone: z
      .string()
      .min(1, 'Please enter a valid phone number')
      .refine(
        (v) => isValidPhoneNumber(v),
        'Please enter a valid phone number',
      ),
    email: z.string().trim().min(1, 'Email is required'),
    password: z.string().min(1, 'Password is required'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export default function SignupPage() {
  const navigate = useNavigate()
  const [info, setInfo] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      setInfo(null)

      try {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: value.email,
          password: value.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: `${value.firstName} ${value.lastName}`.trim(),
              first_name: value.firstName,
              last_name: value.lastName,
              phone: value.phone,
            },
          },
        })
        if (signUpErr) throw signUpErr
      } catch (err: any) {
        console.error('signUp failed:', {
          message: err?.message,
          status: err?.status,
          name: err?.name,
        })
        setError(err?.message ?? 'Sign up failed')
        return
      }

      // If a session exists immediately (email confirmation OFF),
      // we can upsert into public.profiles right now.
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user) {
        navigate({ to: '/dashboard' })
        return
      }

      // If no session yet (email confirmation ON), show next steps.
      setInfo(
        'Check your email to confirm your account. Your profile will be created after confirmation.',
      )
    },
  })

  // Prevent body scroll and padding issues
  React.useEffect(() => {
    const originalStyle = {
      overflow: document.body.style.overflow,
      padding: document.body.style.padding,
      margin: document.body.style.margin,
    }
    const originalHtmlStyle = {
      overflow: document.documentElement.style.overflow,
      padding: document.documentElement.style.padding,
      margin: document.documentElement.style.margin,
    }

    document.body.style.overflow = 'hidden'
    document.body.style.padding = '0'
    document.body.style.margin = '0'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.padding = '0'
    document.documentElement.style.margin = '0'

    return () => {
      document.body.style.overflow = originalStyle.overflow
      document.body.style.padding = originalStyle.padding
      document.body.style.margin = originalStyle.margin
      document.documentElement.style.overflow = originalHtmlStyle.overflow
      document.documentElement.style.padding = originalHtmlStyle.padding
      document.documentElement.style.margin = originalHtmlStyle.margin
    }
  }, [])

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 1,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <AnimatedBackground intensity={0.1} shapeType="circles" speed={0.5} />
      <Card
        size="4"
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--gray-a2)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Flex direction="column" gap="4">
          <Box>
            <Heading size="7" mb="1">
              Create your account
            </Heading>
            <Text color="gray">Fill in your details to sign up.</Text>
          </Box>

          <Separator size="4" />

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.AppForm>
              <Flex direction="column" gap="3">
                <Flex gap="3" wrap="wrap">
                  <Box style={{ flex: 1, minWidth: 180 }}>
                    <form.AppField name="firstName">
                      {(field) => (
                        <field.TextField
                          label="First name"
                          placeholder="First name"
                        />
                      )}
                    </form.AppField>
                  </Box>
                  <Box style={{ flex: 1, minWidth: 180 }}>
                    <form.AppField name="lastName">
                      {(field) => (
                        <field.TextField
                          label="Last name"
                          placeholder="Last name"
                        />
                      )}
                    </form.AppField>
                  </Box>
                </Flex>

                <form.AppField name="phone">
                  {(field) => (
                    <form.Subscribe selector={(state) => state.isSubmitting}>
                      {(isSubmitting) => (
                        <Box>
                          <Text
                            as="label"
                            size="2"
                            color="gray"
                            mb="1"
                            style={{ display: 'block' }}
                          >
                            Phone number
                          </Text>
                          <PhoneInputField
                            id="signup-phone"
                            value={field.state.value || undefined}
                            onChange={(v) => field.handleChange(v ?? '')}
                            defaultCountry="NO"
                            placeholder="Enter phone number"
                            disabled={isSubmitting}
                          />
                        </Box>
                      )}
                    </form.Subscribe>
                  )}
                </form.AppField>

                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      label="Email"
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                    />
                  )}
                </form.AppField>

                <Box>
                  <form.AppField name="password">
                    {(field) => (
                      <field.TextField
                        label="Password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    )}
                  </form.AppField>
                  <form.Subscribe selector={(state) => state.values.password}>
                    {(password) =>
                      password && (
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
                            {PASSWORD_REQUIREMENTS.map((req) => {
                              const satisfied = req.check(password)
                              return (
                                <Flex key={req.id} align="center" gap="2">
                                  <Checkbox checked={satisfied} disabled />
                                  <Text
                                    size="2"
                                    style={{
                                      color: satisfied
                                        ? 'var(--green-11)'
                                        : 'var(--gray-11)',
                                      textDecoration: satisfied
                                        ? 'line-through'
                                        : 'none',
                                    }}
                                  >
                                    {req.label}
                                  </Text>
                                </Flex>
                              )
                            })}
                          </Flex>
                        </Box>
                      )
                    }
                  </form.Subscribe>
                </Box>

                <Box>
                  <form.AppField name="confirmPassword">
                    {(field) => (
                      <field.TextField
                        label="Confirm password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    )}
                  </form.AppField>
                  <form.Subscribe
                    selector={(state) => [
                      state.values.password,
                      state.values.confirmPassword,
                    ]}
                  >
                    {([password, confirmPassword]) =>
                      password &&
                      confirmPassword && (
                        <Box mt="2">
                          {password === confirmPassword ? (
                            <Text size="2" color="green">
                              ✓ Passwords match
                            </Text>
                          ) : (
                            <Text size="2" color="red">
                              ✗ Passwords do not match
                            </Text>
                          )}
                        </Box>
                      )
                    }
                  </form.Subscribe>
                </Box>

                {error && <Text color="red">{error}</Text>}
                {info && <Text color="green">{info}</Text>}

                <form.SubmitButton
                  label="Create account"
                  pendingLabel="Creating account…"
                />

                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="2"
                      onClick={() => navigate({ to: '/login' })}
                      disabled={isSubmitting}
                    >
                      Back to sign in
                    </Button>
                  )}
                </form.Subscribe>
              </Flex>
            </form.AppForm>
          </form>

          <Text size="2" color="gray">
            By creating an account, you agree to our{' '}
            <Link to="/legal" style={{ textDecoration: 'underline' }}>
              terms and privacy policy.
            </Link>
          </Text>
        </Flex>
      </Card>
    </Box>
  )
}
