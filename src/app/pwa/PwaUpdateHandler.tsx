import * as React from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  GRID_BOOTED_ATTR,
  GRID_SW_RECOVERY_KEY,
  clearGridServiceWorkerCaches,
} from './bootRecovery'
import { createPwaUpdateFlow } from './pwaUpdateFlow'

export function PwaUpdateHandler() {
  const toast = useToast()
  // Keep show stable across ToastProvider re-renders so we never put `toast`
  // in the effect deps (that recreated registerSW and re-fired onNeedRefresh).
  const showToastRef = React.useRef(toast.show)
  showToastRef.current = toast.show

  React.useEffect(() => {
    // Mark that the React shell mounted successfully so the index.html
    // watchdog does not treat a slow first paint as a stale-SW failure.
    document.documentElement.setAttribute(GRID_BOOTED_ATTR, '1')
    try {
      sessionStorage.removeItem(GRID_SW_RECOVERY_KEY)
    } catch {
      // ignore quota / private-mode failures
    }

    const flow = createPwaUpdateFlow({
      showToast: (opts) => showToastRef.current(opts),
      clearCaches: clearGridServiceWorkerCaches,
      reload: () => window.location.reload(),
    })

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        flow.onNeedRefresh(updateSW)
      },
      onRegisterError() {
        flow.onRegisterError()
      },
    })
  }, [])

  return null
}
