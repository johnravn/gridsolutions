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
 *
 * Guards are module-scoped so StrictMode remounts / effect re-runs that call
 * registerSW again cannot stack identical "new version" toasts.
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

/** Session-level: at most one need-refresh toast until full navigation. */
let needRefreshToastShown = false
/** Session-level: at most one register-error toast until full navigation. */
let registerErrorToastShown = false
/** True while Reload → updateSW/clearCaches is running. */
let updateInFlight = false

/** Test-only: reset module guards between cases. */
export function resetPwaUpdateFlowGuardsForTests() {
  needRefreshToastShown = false
  registerErrorToastShown = false
  updateInFlight = false
}

export function createPwaUpdateFlow(deps: PwaUpdateFlowDeps): PwaUpdateFlow {
  return {
    onNeedRefresh(updateSW) {
      if (needRefreshToastShown || updateInFlight) return
      needRefreshToastShown = true

      deps.showToast({
        kind: 'info',
        title: 'A new version is available',
        description: 'Reload to get the latest updates.',
        duration: 0,
        onUndo: () => {
          if (updateInFlight) return
          updateInFlight = true
          void updateSW(true).finally(() => {
            // Page should reload after SKIP_WAITING. If it does not, allow
            // another click on the same toast — but never open a second one.
            updateInFlight = false
          })
        },
        undoLabel: 'Reload',
      })
    },

    onRegisterError() {
      if (registerErrorToastShown || updateInFlight) return
      registerErrorToastShown = true

      deps.showToast({
        kind: 'error',
        title: 'Could not update the app shell',
        description: 'Reload to clear a stale offline cache.',
        duration: 0,
        onUndo: () => {
          if (updateInFlight) return
          updateInFlight = true
          void (async () => {
            try {
              await deps.clearCaches()
            } catch {
              // still reload — network fetch may be enough
            }
            deps.reload()
          })().finally(() => {
            updateInFlight = false
          })
        },
        undoLabel: 'Reload',
      })
    },
  }
}
