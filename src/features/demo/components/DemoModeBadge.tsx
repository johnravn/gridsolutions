import * as React from 'react'
import { Badge } from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useDemoMode } from '@features/demo/hooks/useDemoMode'
import {
  registerDemoWriteBlockedHandler,
  setDemoModeActive,
} from '@features/demo/lib/demoModeState'

export function DemoModeBadge() {
  const { isDemoMode } = useDemoMode()
  const toast = useToast()

  React.useEffect(() => {
    setDemoModeActive(isDemoMode)
    return () => setDemoModeActive(false)
  }, [isDemoMode])

  React.useEffect(() => {
    registerDemoWriteBlockedHandler(() => {
      toast.info(
        'Not allowed in demo mode',
        "Changes aren't saved while exploring the demo.",
        4000,
      )
    })
    return () => registerDemoWriteBlockedHandler(null)
  }, [toast])

  if (!isDemoMode) return null

  return (
    <Badge
      role="status"
      aria-live="polite"
      color="blue"
      variant="solid"
      size="2"
      highContrast
      style={{
        position: 'fixed',
        right: 'calc(16px + var(--app-safe-right))',
        bottom: 'calc(16px + var(--app-safe-bottom))',
        zIndex: 2147483647,
        fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        pointerEvents: 'none',
      }}
    >
      Demo mode
    </Badge>
  )
}
