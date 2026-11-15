import * as React from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useToast } from '@shared/ui/toast/ToastProvider'

export function PwaUpdateHandler() {
  const toast = useToast()
  const promptedRef = React.useRef(false)
  const registerErrorRef = React.useRef(false)

  React.useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (promptedRef.current) return
        promptedRef.current = true

        toast.show({
          kind: 'info',
          title: 'A new version is available',
          description: 'Reload to get the latest updates.',
          duration: 0,
          onUndo: () => {
            void updateSW(true)
          },
          undoLabel: 'Reload',
        })
      },
      onRegisterError() {
        // Stale SW / missing workbox chunk after a deploy can surface as Safari's
        // "'text/html' is not a valid JavaScript MIME type" when the host SPA
        // fallback returns index.html for a .js URL. Offer a hard reload once.
        if (registerErrorRef.current) return
        registerErrorRef.current = true

        toast.show({
          kind: 'error',
          title: 'Could not update the app shell',
          description: 'Reload to clear a stale offline cache.',
          duration: 0,
          onUndo: () => {
            window.location.reload()
          },
          undoLabel: 'Reload',
        })
      },
    })
  }, [toast])

  return null
}
