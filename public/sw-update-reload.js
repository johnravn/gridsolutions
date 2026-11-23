/* Force controlled tabs to reload when a *new* service worker activates.
 *
 * With registerType: 'prompt', a waiting worker never takes over if React
 * cannot mount (stale precache → 404 hashed assets → blank Safari page).
 * autoUpdate + skipWaiting fixes future deploys; this script recovers tabs
 * that are already blank by navigating them once the new worker activates.
 */
;(() => {
  let replacingOlderWorker = false

  self.addEventListener('install', () => {
    // registration.active is set when an older worker still controls clients.
    replacingOlderWorker = !!self.registration.active
  })

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        if (!replacingOlderWorker) return
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        await Promise.all(
          clients.map((client) => {
            if (typeof client.navigate === 'function') {
              return client.navigate(client.url)
            }
            return undefined
          }),
        )
      })(),
    )
  })
})()
