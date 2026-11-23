/**
 * Clear Controllers / Cache Storage when the app shell fails to boot.
 * Used by the inline index.html watchdog and by PwaUpdateHandler.
 */
export async function clearGridServiceWorkerCaches(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((reg) => reg.unregister()))
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
}

export const GRID_BOOTED_ATTR = 'data-grid-booted'
export const GRID_SW_RECOVERY_KEY = 'grid-sw-boot-recovery'
