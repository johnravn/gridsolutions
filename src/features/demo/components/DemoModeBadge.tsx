import * as React from 'react'
import { Badge } from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useDemoMode } from '@features/demo/hooks/useDemoMode'
import {
  registerDemoWriteBlockedHandler,
  setDemoModeActive,
} from '@features/demo/lib/demoModeState'

export function DemoModeBadge({
  placement = 'fixed',
}: {
  placement?: 'fixed' | 'inline'
}) {
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
      className={
        placement === 'inline'
          ? 'app-demo-mode-badge app-demo-mode-badge--inline'
          : 'app-demo-mode-badge'
      }
    >
      Demo mode
    </Badge>
  )
}
