import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Box, Flex, Spinner, Text } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { enterDemo } from '../api/demoQueries'

export default function DemoPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function startDemo() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const session = sessionData.session

        if (session?.user && !session.user.is_anonymous) {
          navigate({ to: '/dashboard' })
          return
        }

        await enterDemo()
        if (cancelled) return
        await qc.invalidateQueries({ queryKey: ['auth', 'user'] })
        await qc.invalidateQueries({ queryKey: ['my-companies'] })
        await qc.invalidateQueries({ queryKey: ['profile'] })
        await qc.invalidateQueries({ queryKey: ['authz'] })
        navigate({ to: '/dashboard' })
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : 'Could not start demo mode',
        )
      }
    }

    void startDemo()
    return () => {
      cancelled = true
    }
  }, [navigate, qc])

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(160deg, var(--color-background) 0%, var(--gray-2) 35%, var(--accent-a1) 70%, var(--gray-2) 100%)',
      }}
    >
      <Box style={{ textAlign: 'center' }}>
        {error ? (
          <Flex direction="column" gap="3" align="center">
            <Text size="4" color="red">
              {error}
            </Text>
            <Text
              size="2"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate({ to: '/' })}
            >
              Back to home
            </Text>
          </Flex>
        ) : (
          <Flex direction="column" gap="3" align="center">
            <Spinner size="3" />
            <Text size="4" color="gray">
              Loading demo…
            </Text>
          </Flex>
        )}
      </Box>
    </Flex>
  )
}
