import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@shared/api/supabase'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { NavArrowLeft } from 'iconoir-react'
import { AnimatedBackground } from '@shared/ui/components/AnimatedBackground'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (signInError) return setError(signInError.message)
    navigate({ to: '/dashboard' })
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
          <form onSubmit={signIn}>
            <Flex direction="column" gap="3">
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
                  size="3"
                  required
                />
              </Box>

              <Box>
                <Flex justify="between" align="center" mb="1">
                  <Text as="label" size="2" color="gray">
                    Password
                  </Text>
                  {/* Optional forgot link spot */}
                  {/* <Text size="2" color="gray"><Link to="/forgot">Forgot?</Link></Text> */}
                </Flex>
                <TextField.Root
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  size="3"
                  required
                />
              </Box>

              {error && <Text color="red">{error}</Text>}

              <Flex gap="3" align="center">
                <Button
                  type="submit"
                  size="2"
                  disabled={loading}
                  variant="classic"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="2"
                  onClick={() => navigate({ to: '/signup' })}
                  disabled={loading}
                >
                  Create account
                </Button>
              </Flex>
            </Flex>
          </form>
        </Flex>
      </Card>
    </Box>
  )
}
