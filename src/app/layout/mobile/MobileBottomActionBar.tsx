import * as React from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

function portalHost(): HTMLElement {
  return document.querySelector<HTMLElement>('.radix-themes') ?? document.body
}

/** Fixed bottom action slot between the menu and inspector FABs. Phone only. */
export function MobileBottomActionBar({
  hidden,
  extendRight,
  children,
}: {
  hidden?: boolean
  /** Extend to the right edge (use on pages without an inspector FAB). */
  extendRight?: boolean
  children: ReactNode
}) {
  const [host, setHost] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    setHost(portalHost())
  }, [])

  if (hidden || !host) return null

  return createPortal(
    <div
      className={[
        'app-mobile-bottom-action-bar',
        extendRight ? 'app-mobile-bottom-action-bar--extend-right' : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>,
    host,
  )
}
