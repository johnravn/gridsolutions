import * as React from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useToast } from '@shared/ui/toast/ToastProvider'

export function PwaUpdateHandler() {
  const toast = useToast()
  const promptedRef = React.useRef(false)

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
    })
  }, [toast])

  return null
}
