import * as React from 'react'
import { createPortal } from 'react-dom'
import { Box, Flex, Heading, IconButton, Separator } from '@radix-ui/themes'
import { Xmark } from 'iconoir-react'
import { useLockAppMainScroll } from './useLockAppMainScroll'
import { useBlurFocusedDescendantWhenClosed } from './useBlurFocusedDescendantWhenClosed'

const DRAWER_ID = 'mobile-bottom-drawer'

function portalHost(): HTMLElement {
  return document.querySelector<HTMLElement>('.radix-themes') ?? document.body
}

export function MobileBottomDrawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  children: React.ReactNode
}) {
  const [host, setHost] = React.useState<HTMLElement | null>(null)
  const drawerRef = useBlurFocusedDescendantWhenClosed(open)
  useLockAppMainScroll(open, true)

  React.useEffect(() => {
    setHost(portalHost())
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
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
        className="app-bottom-drawer"
        data-open={open ? 'true' : undefined}
        aria-label={typeof title === 'string' ? title : 'Details'}
        inert={!open ? true : undefined}
      >
        {/* Glass on a sibling so WebKit hit-tests the scrolling content. */}
        <div
          className="app-bottom-drawer-surface app-sidebar-glass"
          aria-hidden
        />
        <Flex
          className="app-bottom-drawer-inner"
          direction="column"
          gap="4"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Flex
            align="center"
            justify="between"
            gap="3"
            style={{ flexShrink: 0 }}
          >
            <Box style={{ minWidth: 0, flex: 1 }}>{heading}</Box>
            <IconButton
              type="button"
              size="2"
              variant="ghost"
              color="gray"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <Xmark width={18} height={18} />
            </IconButton>
          </Flex>
          <Separator size="4" />
          <Box className="app-bottom-drawer-body">{children}</Box>
        </Flex>
      </aside>
    </>,
    host,
  )
}

export { DRAWER_ID as MOBILE_BOTTOM_DRAWER_ID }
