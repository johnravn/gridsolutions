import * as React from 'react'

/**
 * Traps the Android hardware back button when a mobile detail panel is open.
 * Pushes a history entry while open; back clears the detail instead of leaving the app.
 */
export function useMobileDetailBack(
  enabled: boolean,
  isOpen: boolean,
  onClose: () => void,
): void {
  const trapActiveRef = React.useRef(false)
  const onCloseRef = React.useRef(onClose)

  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  React.useEffect(() => {
    if (!enabled || !isOpen) {
      if (trapActiveRef.current) {
        trapActiveRef.current = false
        window.history.back()
      }
      return
    }

    window.history.pushState({ gridMobileDetail: true }, '')
    trapActiveRef.current = true

    const handlePopState = () => {
      trapActiveRef.current = false
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled, isOpen])
}
