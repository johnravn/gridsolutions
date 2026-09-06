// src/features/login/pages/AuthCallback.tsx
import * as React from 'react'
import { supabase } from '@shared/api/supabase'
import { useNavigate } from '@tanstack/react-router'
import { Card, Flex, Heading, Text } from '@radix-ui/themes'
import { fetchProfileCompleteness, isProfileComplete } from '@shared/auth/oauth'

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

/** Prevent React Strict Mode from exchanging the same PKCE code twice. */
const exchangedCodes = new Set<string>()

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const run = async () => {
      const url = new URL(window.location.href)
      const code =
        url.searchParams.get('code') || url.hash.match(/code=([^&]+)/)?.[1]
      const tokenHash =
        url.searchParams.get('token_hash') ||
        url.hash.match(/token_hash=([^&]+)/)?.[1]
      const type =
        url.searchParams.get('type') || url.hash.match(/type=([^&]+)/)?.[1]
      const next = safeNextPath(url.searchParams.get('next'))

      try {
        if (code) {
          if (exchangedCodes.has(code)) {
            const { data: s } = await supabase.auth.getSession()
            if (!s.session) {
              throw new Error(
                'Sign-in already in progress. If this stuck, open http://127.0.0.1:3000 (not localhost) and try again.',
              )
            }
          } else {
            exchangedCodes.add(code)
            const { error: excErr } =
              await supabase.auth.exchangeCodeForSession(code)
            if (excErr) {
              exchangedCodes.delete(code)
              const hint = /flow state|code verifier|pkce/i.test(excErr.message)
                ? ' Use http://127.0.0.1:3000 (not localhost) so Google sign-in can finish.'
                : ''
              throw new Error(`${excErr.message}.${hint}`)
            }
          }
        } else if (tokenHash && type) {
          // Email confirmation / recovery links use token_hash, not OAuth PKCE.
          const { error: verErr } = await supabase.auth.verifyOtp({
            type: type as 'signup' | 'email' | 'recovery' | 'invite',
            token_hash: tokenHash,
          })
          if (verErr) throw verErr
        } else {
          const { data: s } = await supabase.auth.getSession()
          if (!s.session) {
            throw new Error('Missing sign-in code. Try signing in again.')
          }
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const user = sessionData.session?.user
        if (!user) throw new Error('No session after sign-in')

        // Linking return: go back to profile Sign-in methods
        if (next?.startsWith('/profile')) {
          if (!cancelled) {
            void navigate({
              to: '/profile',
              search: { tab: 'auth' },
            })
          }
          return
        }

        if (user.is_anonymous) {
          if (!cancelled) void navigate({ to: '/dashboard' })
          return
        }

        const profile = await fetchProfileCompleteness(user.id)
        if (!cancelled) {
          if (!isProfileComplete(profile)) {
            void navigate({ to: '/complete-profile' })
          } else {
            void navigate({ to: '/dashboard' })
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Could not complete sign-in',
          )
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100dvh' }}>
        <Card size="3" style={{ width: 420, background: 'var(--gray-a2)' }}>
          <Heading size="5" mb="2">
            Sign-in error
          </Heading>
          <Text color="red">{error}</Text>
        </Card>
      </Flex>
    )
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100dvh' }}>
      <Text color="gray">Completing sign-in…</Text>
    </Flex>
  )
}
