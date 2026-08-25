import * as React from 'react'

/**
 * Closed drawers stay in the DOM with `inert`. If a descendant still has
 * focus (e.g. the nav link that just closed the menu), blur it so keyboard
 * focus is not trapped in an inert subtree.
 */
export function useBlurFocusedDescendantWhenClosed<
  T extends HTMLElement = HTMLElement,
>(open: boolean) {
  const ref = React.useRef<T | null>(null)

  React.useEffect(() => {
    if (open) return
    const root = ref.current
    const active = document.activeElement
    if (root && active instanceof HTMLElement && root.contains(active)) {
      active.blur()
    }
  }, [open])

  return ref
}
