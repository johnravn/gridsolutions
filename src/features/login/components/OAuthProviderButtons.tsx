import * as React from 'react'
import { Button, Flex, Text } from '@radix-ui/themes'
import {
  resumePendingOAuthProvider,
  signInWithOAuthProvider,
} from '@shared/auth/oauth'
import type { OAuthProvider } from '@shared/auth/oauth'

type Props = {
  disabled?: boolean
  onError?: (message: string) => void
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.1 39.5 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.5 6.9l.1.1 6.2 5.2C36.9 41.4 44 36 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  )
}

export function OAuthProviderButtons({ disabled, onError }: Props) {
  const [pending, setPending] = React.useState<OAuthProvider | null>(null)

  const start = React.useCallback(
    async (provider: OAuthProvider) => {
      setPending(provider)
      try {
        const { error } = await signInWithOAuthProvider(provider)
        if (error) {
          onError?.(error.message)
          setPending(null)
        }
        // On success the browser navigates away to the provider (or to 127.0.0.1).
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Could not start sign-in'
        onError?.(message)
        setPending(null)
      }
    },
    [onError],
  )

  React.useEffect(() => {
    void resumePendingOAuthProvider().then((result) => {
      if (!result) return
      if (result.error) {
        onError?.(result.error.message)
        setPending(null)
        return
      }
      setPending('google')
    })
  }, [onError])

  return (
    <Flex direction="column" gap="2" width="100%">
      <Button
        type="button"
        size="3"
        variant="outline"
        disabled={disabled || pending !== null}
        onClick={() => void start('google')}
        style={{ width: '100%', justifyContent: 'center', gap: 8 }}
      >
        <GoogleGlyph />
        {pending === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </Button>
      <Text size="1" color="gray" align="center">
        Same Google email links to your existing Grid account when verified.
      </Text>
    </Flex>
  )
}
