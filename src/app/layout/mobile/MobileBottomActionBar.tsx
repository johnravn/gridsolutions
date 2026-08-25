import * as React from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

function portalHost(): HTMLElement {
  return document.querySelector<HTMLElement>('.radix-themes') ?? document.body
}

/** Fixed bottom action slot between the menu and inspector FABs. Phone only. */
export function MobileBottomActionBar({
  hidden,
  children,
}: {
  hidden?: boolean
  children: ReactNode
}) {
  const [host, setHost] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    setHost(portalHost())
  }, [])

  if (hidden || !host) return null

  return createPortal(
    <div className="app-mobile-bottom-action-bar">{children}</div>,
    host,
  )
}
