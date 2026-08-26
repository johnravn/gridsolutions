import * as React from 'react'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'
import { useMobileNav } from './MobileNavContext'

/**
 * Drawer open state for split-page inspectors on small screens.
 * Keeps selection when closed; traps Android back while open; closes on desktop.
 * Mutually exclusive with the mobile nav menu — only one may be open.
 */
export function useMobileInspectorDrawer(isLarge: boolean) {
  const { navOpen, setNavOpen } = useMobileNav()
  const [drawerOpen, setDrawerOpenState] = React.useState(false)

  const closeDrawer = React.useCallback(() => {
    setDrawerOpenState(false)
  }, [])

  const openDrawer = React.useCallback(() => {
    setNavOpen(false)
    setDrawerOpenState(true)
  }, [setNavOpen])

  const toggleDrawer = React.useCallback(() => {
    setDrawerOpenState((open) => {
      const next = !open
      if (next) setNavOpen(false)
      return next
    })
  }, [setNavOpen])

  const setDrawerOpen = React.useCallback(
    (open: boolean) => {
      if (open) setNavOpen(false)
      setDrawerOpenState(open)
    },
    [setNavOpen],
  )

  useMobileDetailBack(!isLarge, drawerOpen, closeDrawer)

  React.useEffect(() => {
    if (isLarge) setDrawerOpenState(false)
  }, [isLarge])

  React.useEffect(() => {
    if (navOpen) setDrawerOpenState(false)
  }, [navOpen])

  return { drawerOpen, setDrawerOpen, closeDrawer, openDrawer, toggleDrawer }
}
