/** 1 = down the sidebar (content glides up); -1 = up (content glides down). */
export type PageNavDirection = 1 | -1

let pendingDirection: PageNavDirection | null = null

/** Set by keyboard sidebar cycling so wrap-around keeps the intended glide. */
export function setPendingPageNavDirection(direction: PageNavDirection) {
  pendingDirection = direction
}

export function takePendingPageNavDirection(): PageNavDirection | null {
  const direction = pendingDirection
  pendingDirection = null
  return direction
}

export function findSidebarNavIndex(
  routes: ReadonlyArray<string>,
  currentPath: string,
): number {
  const exact = routes.findIndex((to) => currentPath === to)
  if (exact !== -1) return exact

  let best = -1
  let bestLen = -1
  routes.forEach((to, index) => {
    if (currentPath.startsWith(`${to}/`) && to.length > bestLen) {
      best = index
      bestLen = to.length
    }
  })
  return best
}

/** Compare two paths against sidebar order when no keyboard direction was set. */
export function resolvePageNavDirection(
  routes: ReadonlyArray<string>,
  fromPath: string,
  toPath: string,
  fallback: PageNavDirection = 1,
): PageNavDirection {
  const from = findSidebarNavIndex(routes, fromPath)
  const to = findSidebarNavIndex(routes, toPath)
  if (from === -1 || to === -1 || from === to) return fallback
  return to > from ? 1 : -1
}
