/**
 * Intended PWA update UX (prompt mode):
 *
 * 1. Healthy tab — when a new SW is waiting, show a sticky toast once.
 *    Reload → updateSW(true) → SKIP_WAITING → page picks up new assets.
 * 2. Broken shell — if registerSW fails (stale workbox / HTML-as-JS), offer
 *    a one-shot hard recovery that clears SW + Cache Storage.
 * 3. Blank Safari before React mounts — handled by index.html boot watchdog
 *    (not this module). Keep that independent of the toast path.
 *
 * Do not use registerType: 'autoUpdate' here: it skipWaiting/clientsClaim
 * without a prompt and races forced client navigations, which is what made
 * reload-on-new-version feel worse after the Safari blank-page fix (#206).
 */

export type PwaUpdateToastShow = (opts: {
  kind: 'info' | 'error'
  title: string
  description: string
  duration: number
  onUndo: () => void
  undoLabel: string
}) => void

export type PwaUpdateFlowDeps = {
  showToast: PwaUpdateToastShow
  clearCaches: () => Promise<void>
  reload: () => void
}

export type PwaUpdateFlow = {
  onNeedRefresh: (updateSW: (reloadPage?: boolean) => Promise<void>) => void
  onRegisterError: () => void
}

export function createPwaUpdateFlow(deps: PwaUpdateFlowDeps): PwaUpdateFlow {
  let prompted = false
  let registerErrorPrompted = false

  return {
    onNeedRefresh(updateSW) {
      if (prompted) return
      prompted = true

      deps.showToast({
        kind: 'info',
        title: 'A new version is available',
        description: 'Reload to get the latest updates.',
        duration: 0,
        onUndo: () => {
          void updateSW(true)
        },
        undoLabel: 'Reload',
      })
    },

    onRegisterError() {
      if (registerErrorPrompted) return
      registerErrorPrompted = true

      deps.showToast({
        kind: 'error',
        title: 'Could not update the app shell',
        description: 'Reload to clear a stale offline cache.',
        duration: 0,
        onUndo: () => {
          void (async () => {
            try {
              await deps.clearCaches()
            } catch {
              // still reload — network fetch may be enough
            }
            deps.reload()
          })()
        },
        undoLabel: 'Reload',
      })
    },
  }
}
