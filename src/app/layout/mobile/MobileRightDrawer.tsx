import * as React from 'react'
import { createPortal } from 'react-dom'
import { Box, Flex, Heading, Separator } from '@radix-ui/themes'
import { useLockAppMainScroll } from './useLockAppMainScroll'
import { useBlurFocusedDescendantWhenClosed } from './useBlurFocusedDescendantWhenClosed'

const DRAWER_ID = 'mobile-right-drawer'

function portalHost(): HTMLElement {
  return document.querySelector<HTMLElement>('.radix-themes') ?? document.body
}

export function MobileRightDrawer({
  open,
  onOpenChange,
  title = 'Inspector',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  children: React.ReactNode
}) {
  const [host, setHost] = React.useState<HTMLElement | null>(null)
  const drawerRef = useBlurFocusedDescendantWhenClosed(open)
  useLockAppMainScroll(open)

  React.useEffect(() => {
    setHost(portalHost())
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Capture phase: dialog is still open when Escape fires, so we defer to it
      // instead of closing the inspector in the same keypress.
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [data-state="open"].rt-DialogContent',
        )
      ) {
        return
      }
      onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onOpenChange])

  const heading =
    typeof title === 'string' || typeof title === 'number' ? (
      <Heading size="5">{title}</Heading>
    ) : (
      title
    )

  if (!host) return null

  return createPortal(
    <>
      <div
        className="app-inspector-backdrop"
        data-open={open ? 'true' : undefined}
        aria-hidden={!open}
        onClick={() => onOpenChange(false)}
      />
      <aside
        ref={drawerRef}
        id={DRAWER_ID}
        className="app-sidebar-glass app-inspector-drawer"
        data-open={open ? 'true' : undefined}
        aria-label={typeof title === 'string' ? title : 'Inspector'}
        inert={!open ? true : undefined}
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100svh',
          width: 'var(--app-inspector-drawer-width)',
          margin: 0,
          borderRadius: 0,
          borderLeft: '1px solid var(--gray-a5)',
          boxShadow: 'var(--shadow-4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Flex direction="column" gap="4" style={{ flex: 1, minHeight: 0 }}>
          <Box>{heading}</Box>
          <Separator size="4" />
          <Box className="app-inspector-drawer-body">{children}</Box>
        </Flex>
      </aside>
    </>,
    host,
  )
}

export { DRAWER_ID as MOBILE_RIGHT_DRAWER_ID }
