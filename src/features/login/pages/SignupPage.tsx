// src/features/login/pages/SignupPage.tsx
import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { supabase } from '@shared/api/supabase'
import { isValidPhoneNumber } from 'react-phone-number-input' // ✅ add this
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
  TextField,
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

export default function SignupPage() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [phone, setPhone] = React.useState<string | undefined>(undefined) // ✅ allow undefined
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)

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

  const passwordRequirements = React.useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      satisfied: req.check(password),
    }))
  }, [password])

  const passwordsMatch = React.useMemo(() => {
    if (!password || !confirmPassword) return null
    return password === confirmPassword
  }, [password, confirmPassword])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!phone || !isValidPhoneNumber(phone)) {
      setError('Please enter a valid phone number')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: `${firstName} ${lastName}`.trim(),
            first_name: firstName,
            last_name: lastName,
            phone,
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
      setLoading(false)
      setError(err?.message ?? 'Sign up failed')
      return
    }

    // 2) If a session exists immediately (email confirmation OFF),
    //    we can upsert into public.profiles right now.
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session?.user) {
      setLoading(false)
      navigate({ to: '/dashboard' })
      return
    }

    // 3) If no session yet (email confirmation ON), show next steps.
    setLoading(false)
    setInfo(
      'Check your email to confirm your account. Your profile will be created after confirmation.',
    )
  }

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

          <form onSubmit={onSubmit}>
            <Flex direction="column" gap="3">
              <Flex gap="3" wrap="wrap">
                <Box style={{ flex: 1, minWidth: 180 }}>
                  <Text
                    as="label"
                    size="2"
                    color="gray"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    First name
                  </Text>
                  <TextField.Root
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    size="3"
                  />
                </Box>
                <Box style={{ flex: 1, minWidth: 180 }}>
                  <Text
                    as="label"
                    size="2"
                    color="gray"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    Last name
                  </Text>
                  <TextField.Root
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    size="3"
                  />
                </Box>
              </Flex>

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
                  value={phone}
                  onChange={setPhone}
                  defaultCountry="NO"
                  placeholder="Enter phone number"
                  disabled={loading}
                />
              </Box>

              <Box>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  mb="1"
                  style={{ display: 'block' }}
                >
                  Email
                </Text>
                <TextField.Root
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  size="3"
                />
              </Box>

              <Box>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  mb="1"
                  style={{ display: 'block' }}
                >
                  Password
                </Text>
                <TextField.Root
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  size="3"
                />
                {password && (
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
              </Box>

              <Box>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  mb="1"
                  style={{ display: 'block' }}
                >
                  Confirm password
                </Text>
                <TextField.Root
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  size="3"
                />
                {passwordsMatch !== null && (
                  <Box mt="2">
                    {passwordsMatch ? (
                      <Text size="2" color="green">
                        ✓ Passwords match
                      </Text>
                    ) : (
                      <Text size="2" color="red">
                        ✗ Passwords do not match
                      </Text>
                    )}
                  </Box>
                )}
              </Box>

              {error && <Text color="red">{error}</Text>}
              {info && <Text color="green">{info}</Text>}

              <Button
                type="submit"
                size="2"
                disabled={loading}
                variant="classic"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="2"
                onClick={() => navigate({ to: '/login' })}
                disabled={loading}
              >
                Back to sign in
              </Button>
            </Flex>
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
