/** Desktop nav rail — expanded labels vs icon-only collapse. */
export const SIDEBAR_EXPANDED = 200
export const SIDEBAR_COLLAPSED = 64

/** Reserved width for the desktop sidebar slot (0 on mobile; drawer is fixed). */
export function getDesktopSidebarWidth(open: boolean): number {
  return open ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED
}
