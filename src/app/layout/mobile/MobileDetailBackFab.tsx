import { createPortal } from 'react-dom'
import { IconButton } from '@radix-ui/themes'
import { NavArrowLeft } from 'iconoir-react'
import { MOBILE_RIGHT_DRAWER_ID } from './MobileRightDrawer'

/**
 * Bottom-left Back FAB while the mobile inspector is open.
 * Occupies the menu FAB slot (menu is CSS-hidden); closes full-screen detail.
 */
export function MobileDetailBackFab({ onBack }: { onBack: () => void }) {
  return createPortal(
    <IconButton
      size="3"
      variant="ghost"
      className="app-detail-back-fab"
      aria-label="Back"
      aria-controls={MOBILE_RIGHT_DRAWER_ID}
      onClick={onBack}
    >
      <NavArrowLeft width={22} height={22} strokeWidth={2} aria-hidden />
    </IconButton>,
    document.body,
  )
}
