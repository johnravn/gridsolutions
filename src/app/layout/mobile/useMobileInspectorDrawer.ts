import * as React from 'react'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'

/**
 * Drawer open state for split-page inspectors on small screens.
 * Keeps selection when closed; traps Android back while open; closes on desktop.
 */
export function useMobileInspectorDrawer(isLarge: boolean) {
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const openDrawer = React.useCallback(() => {
    setDrawerOpen(true)
  }, [])

  const toggleDrawer = React.useCallback(() => {
    setDrawerOpen((open) => !open)
  }, [])

  useMobileDetailBack(!isLarge, drawerOpen, closeDrawer)

  React.useEffect(() => {
    if (isLarge) setDrawerOpen(false)
  }, [isLarge])

  return { drawerOpen, setDrawerOpen, closeDrawer, openDrawer, toggleDrawer }
}
