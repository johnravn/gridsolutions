import { createPortal } from 'react-dom'
import { IconButton } from '@radix-ui/themes'
import { NavArrowLeft, NavArrowRight } from 'iconoir-react'
import { MOBILE_RIGHT_DRAWER_ID } from './MobileRightDrawer'
import { useMobileNav } from './MobileNavContext'

export function MobileDrawerFab({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  const { navOpen } = useMobileNav()

  return createPortal(
    <IconButton
      size="3"
      variant="ghost"
      className="app-inspector-fab"
      data-open={open ? 'true' : undefined}
      disabled={navOpen}
      inert={navOpen ? true : undefined}
      aria-label={open ? 'Close inspector' : 'Open inspector'}
      aria-expanded={open}
      aria-controls={MOBILE_RIGHT_DRAWER_ID}
      onClick={navOpen ? undefined : onToggle}
    >
      <span className="app-menu-fab-icons" aria-hidden>
        <NavArrowLeft
          className="app-menu-fab-icons__menu"
          width={22}
          height={22}
          strokeWidth={2}
        />
        <NavArrowRight
          className="app-menu-fab-icons__close"
          width={22}
          height={22}
          strokeWidth={2}
        />
      </span>
    </IconButton>,
    document.body,
  )
}
