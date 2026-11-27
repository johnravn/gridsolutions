/**
 * Cross-cutting PWA update prompt locks.
 *
 * Module `let`s alone are not enough if the main bundle is evaluated more than
 * once in one tab (stale+fresh chunks) or if registerSW is re-entered: each
 * copy can show another toast. Window + sessionStorage locks are shared by
 * every copy in the tab for the life of the session.
 *
 * Prod rebuild (#269): verify one reload toast after the next patch deploy.
 */

export const PWA_NEED_REFRESH_DEDUPE_KEY = 'pwa-need-refresh'
export const PWA_REGISTER_ERROR_DEDUPE_KEY = 'pwa-register-error'

const SESSION_NEED_REFRESH_KEY = 'grid-pwa-need-refresh-locked'
const SESSION_REGISTER_ERROR_KEY = 'grid-pwa-register-error-locked'
const WINDOW_LOCK_KEY = '__gridPwaUpdateLocks'
const WINDOW_REGISTER_KEY = '__gridPwaUpdateRegistered'

type WindowLocks = {
  needRefresh: boolean
  registerError: boolean
  updateInFlight: boolean
}

function readWindowLocks(): WindowLocks {
  const w = window as Window & { [WINDOW_LOCK_KEY]?: WindowLocks }
  if (!w[WINDOW_LOCK_KEY]) {
    w[WINDOW_LOCK_KEY] = {
      needRefresh: false,
      registerError: false,
      updateInFlight: false,
    }
  }
  return w[WINDOW_LOCK_KEY]
}

function sessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function setSessionFlag(key: string) {
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    // ignore quota / private-mode failures
  }
}

export function isNeedRefreshLocked(): boolean {
  if (typeof window === 'undefined') return false
  const locks = readWindowLocks()
  return (
    locks.needRefresh ||
    locks.updateInFlight ||
    sessionFlag(SESSION_NEED_REFRESH_KEY)
  )
}

export function lockNeedRefresh() {
  if (typeof window === 'undefined') return
  const locks = readWindowLocks()
  locks.needRefresh = true
  setSessionFlag(SESSION_NEED_REFRESH_KEY)
}

export function isRegisterErrorLocked(): boolean {
  if (typeof window === 'undefined') return false
  const locks = readWindowLocks()
  return (
    locks.registerError ||
    locks.updateInFlight ||
    sessionFlag(SESSION_REGISTER_ERROR_KEY)
  )
}

export function lockRegisterError() {
  if (typeof window === 'undefined') return
  const locks = readWindowLocks()
  locks.registerError = true
  setSessionFlag(SESSION_REGISTER_ERROR_KEY)
}

export function isUpdateInFlight(): boolean {
  if (typeof window === 'undefined') return false
  return readWindowLocks().updateInFlight
}

export function setUpdateInFlight(next: boolean) {
  if (typeof window === 'undefined') return
  readWindowLocks().updateInFlight = next
}

/** True the first time; false if SW registration already happened this tab. */
export function claimPwaRegistrationSlot(): boolean {
  if (typeof window === 'undefined') return true
  const w = window as Window & { [WINDOW_REGISTER_KEY]?: boolean }
  if (w[WINDOW_REGISTER_KEY]) return false
  w[WINDOW_REGISTER_KEY] = true
  return true
}

/** Test-only reset. */
export function resetPwaUpdateGuardsForTests() {
  if (typeof window === 'undefined') return
  const w = window as Window & {
    [WINDOW_LOCK_KEY]?: WindowLocks
    [WINDOW_REGISTER_KEY]?: boolean
  }
  delete w[WINDOW_LOCK_KEY]
  delete w[WINDOW_REGISTER_KEY]
  try {
    sessionStorage.removeItem(SESSION_NEED_REFRESH_KEY)
    sessionStorage.removeItem(SESSION_REGISTER_ERROR_KEY)
  } catch {
    // ignore
  }
}
