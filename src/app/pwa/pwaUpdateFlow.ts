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
 * Prompt locks live in pwaUpdateGuards (window + sessionStorage) so remounts,
 * duplicate bundle eval, and dismiss/re-focus cannot stack toasts.
 */

import {
  PWA_NEED_REFRESH_DEDUPE_KEY,
  PWA_REGISTER_ERROR_DEDUPE_KEY,
  isNeedRefreshLocked,
  isRegisterErrorLocked,
  isUpdateInFlight,
  lockNeedRefresh,
  lockRegisterError,
  setUpdateInFlight,
} from './pwaUpdateGuards'

export type PwaUpdateToastShow = (opts: {
  kind: 'info' | 'error'
  title: string
  description: string
  duration: number
  onUndo: () => void
  undoLabel: string
  dedupeKey: string
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

export { resetPwaUpdateGuardsForTests } from './pwaUpdateGuards'

export function createPwaUpdateFlow(deps: PwaUpdateFlowDeps): PwaUpdateFlow {
  return {
    onNeedRefresh(updateSW) {
      if (isNeedRefreshLocked()) return
      lockNeedRefresh()

      deps.showToast({
        kind: 'info',
        title: 'A new version is available',
        description: 'Reload to get the latest updates.',
        duration: 0,
        dedupeKey: PWA_NEED_REFRESH_DEDUPE_KEY,
        onUndo: () => {
          if (isUpdateInFlight()) return
          setUpdateInFlight(true)
          void updateSW(true).catch(() => {
            // Hard reload below still runs.
          })
          // vite-plugin-pwa reloads on `controlling` when skipWaiting works.
          // Always schedule a fallback navigation so a hung updateSW cannot
          // leave a waiting worker that keeps re-prompting.
          window.setTimeout(() => {
            deps.reload()
          }, 600)
        },
        undoLabel: 'Reload',
      })
    },

    onRegisterError() {
      if (isRegisterErrorLocked()) return
      lockRegisterError()

      deps.showToast({
        kind: 'error',
        title: 'Could not update the app shell',
        description: 'Reload to clear a stale offline cache.',
        duration: 0,
        dedupeKey: PWA_REGISTER_ERROR_DEDUPE_KEY,
        onUndo: () => {
          if (isUpdateInFlight()) return
          setUpdateInFlight(true)
          void (async () => {
            try {
              await deps.clearCaches()
            } catch {
              // still reload — network fetch may be enough
            }
            deps.reload()
          })().finally(() => {
            setUpdateInFlight(false)
          })
        },
        undoLabel: 'Reload',
      })
    },
  }
}
