import * as React from 'react'
import { Box, Text } from '@radix-ui/themes'
import { WifiOff } from 'iconoir-react'

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = React.useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  )

  React.useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <Box
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        marginBottom: 'var(--space-3)',
        padding: '10px 12px',
        borderRadius: 'var(--radius-2)',
        background: 'var(--amber-3)',
        border: '1px solid var(--amber-7)',
        color: 'var(--amber-11)',
      }}
    >
      <Text
        size="2"
        weight="medium"
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <WifiOff width={16} height={16} aria-hidden />
        You&apos;re offline — changes won&apos;t sync until you&apos;re back
        online.
      </Text>
    </Box>
  )
}
