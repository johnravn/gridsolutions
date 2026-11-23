import * as React from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  GRID_BOOTED_ATTR,
  GRID_SW_RECOVERY_KEY,
  clearGridServiceWorkerCaches,
} from './bootRecovery'

export function PwaUpdateHandler() {
  const toast = useToast()
  const registerErrorRef = React.useRef(false)

  React.useEffect(() => {
    // Mark that the React shell mounted successfully so the index.html
    // watchdog does not treat a slow first paint as a stale-SW failure.
    document.documentElement.setAttribute(GRID_BOOTED_ATTR, '1')
    try {
      sessionStorage.removeItem(GRID_SW_RECOVERY_KEY)
    } catch {
      // ignore quota / private-mode failures
    }

    registerSW({
      immediate: true,
      onRegisterError() {
        // Stale SW / missing workbox chunk after a deploy can surface as Safari's
        // "'text/html' is not a valid JavaScript MIME type" or a silent blank
        // page when hashed assets 404. Offer a hard recovery once.
        if (registerErrorRef.current) return
        registerErrorRef.current = true

        toast.show({
          kind: 'error',
          title: 'Could not update the app shell',
          description: 'Reload to clear a stale offline cache.',
          duration: 0,
          onUndo: () => {
            void (async () => {
              try {
                await clearGridServiceWorkerCaches()
              } catch {
                // still reload — network fetch may be enough
              }
              window.location.reload()
            })()
          },
          undoLabel: 'Reload',
        })
      },
    })
  }, [toast])

  return null
}
