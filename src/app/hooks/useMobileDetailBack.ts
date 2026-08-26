import * as React from 'react'

const DETAIL_STATE = { gridMobileDetail: true as const }

function isDetailState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'gridMobileDetail' in state &&
    (state as { gridMobileDetail: unknown }).gridMobileDetail === true
  )
}

/**
 * Traps the Android hardware back button when a mobile detail panel is open.
 * Pushes a history entry while open; back clears the detail instead of leaving the app.
 *
 * `releaseTrap` drops the dummy history entry without calling `history.back()`,
 * so a following `navigate()` is not undone by the close effect.
 */
export function useMobileDetailBack(
  enabled: boolean,
  isOpen: boolean,
  onClose: () => void,
): { releaseTrap: () => void } {
  const trapActiveRef = React.useRef(false)
  const onCloseRef = React.useRef(onClose)

  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const releaseTrap = React.useCallback(() => {
    if (!trapActiveRef.current) return
    trapActiveRef.current = false
    if (isDetailState(window.history.state)) {
      window.history.replaceState(null, '')
    }
  }, [])

  React.useEffect(() => {
    if (!enabled || !isOpen) {
      if (trapActiveRef.current) {
        trapActiveRef.current = false
        window.history.back()
      }
      return
    }

    window.history.pushState(DETAIL_STATE, '')
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

  return { releaseTrap }
}
