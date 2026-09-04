import { Badge, Button, Flex, Text } from '@radix-ui/themes'

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

function AppleGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="#ffffff"
    >
      <path d="M16.365 1.43c0 1.14-.463 2.21-1.226 3.01-.8.84-2.14 1.49-3.27 1.4-.14-1.1.42-2.27 1.17-3.05.8-.84 2.2-1.45 3.33-1.36zM20.8 17.3c-.58 1.33-.86 1.92-1.61 3.1-1.05 1.63-2.53 3.66-4.37 3.68-1.63.02-2.05-1.06-4.27-1.05-2.22.01-2.68 1.07-4.31 1.05-1.84-.02-3.25-1.85-4.3-3.48C.3 17.54-.7 13.1.95 10.05c1.04-1.92 2.68-3.13 4.23-3.13 1.58 0 2.57 1.07 4.27 1.07 1.65 0 2.5-1.08 4.28-1.08 1.37 0 2.82.75 3.85 2.04-3.39 1.86-2.84 6.71.22 8.35z" />
    </svg>
  )
}

/** OAuth providers are shown but disabled until providers are configured. */
export function OAuthProviderButtons(_props: Props) {
  return (
    <Flex direction="column" gap="2" width="100%">
      <Button
        type="button"
        size="3"
        variant="outline"
        disabled
        style={{ width: '100%', justifyContent: 'center', gap: 8 }}
      >
        <GoogleGlyph />
        Continue with Google
        <Badge color="gray" variant="soft" size="1">
          Coming soon
        </Badge>
      </Button>
      <Button
        type="button"
        size="3"
        variant="outline"
        disabled
        style={{ width: '100%', justifyContent: 'center', gap: 8 }}
      >
        <AppleGlyph />
        Continue with Apple
        <Badge color="gray" variant="soft" size="1">
          Coming soon
        </Badge>
      </Button>
      <Text size="1" color="gray" align="center">
        Google and Apple sign-in are coming soon. Use email for now.
      </Text>
    </Flex>
  )
}
