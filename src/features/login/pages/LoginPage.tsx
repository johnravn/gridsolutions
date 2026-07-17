import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { NavArrowLeft } from 'iconoir-react'
import { AnimatedBackground } from '@shared/ui/components/AnimatedBackground'

const defaultValues = {
  email: '',
  password: '',
}

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = React.useState<string | null>(null)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: value.email,
        password: value.password,
      })
      if (signInError) return setError(signInError.message)
      navigate({ to: '/dashboard' })
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
        size="4" // a bit roomier than size="3"
        style={{
          width: '100%',
          maxWidth: 480, // responsive cap on larger screens
          background: 'var(--gray-a2)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Flex direction="column" gap="4">
          {/* Header with back button */}
          <Box style={{ position: 'relative' }}>
            <Flex align="center" justify="between" mb="1">
              <Box>
                <Heading size="7">Sign in</Heading>
              </Box>
              <Button
                size="2"
                variant="ghost"
                onClick={() => navigate({ to: '/' })}
                style={{ gap: '4px' }}
              >
                <NavArrowLeft width={16} height={16} />
                Back
              </Button>
            </Flex>
            <Text color="gray">Welcome back. Please enter your details.</Text>
          </Box>

          <Separator size="4" />

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.AppForm>
              <Flex direction="column" gap="3">
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

                <form.AppField name="password">
                  {(field) => (
                    <field.TextField
                      label="Password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  )}
                </form.AppField>

                {error && <Text color="red">{error}</Text>}

                <Flex gap="3" align="center">
                  <form.SubmitButton
                    label="Sign in"
                    pendingLabel="Signing in…"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="2"
                    onClick={() => navigate({ to: '/signup' })}
                  >
                    Create account
                  </Button>
                </Flex>
              </Flex>
            </form.AppForm>
          </form>
        </Flex>
      </Card>
    </Box>
  )
}
