import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearGridServiceWorkerCaches } from './bootRecovery'

describe('clearGridServiceWorkerCaches', () => {
  const unregister = vi.fn(async () => true)
  const deleteCache = vi.fn(async () => true)

  beforeEach(() => {
    unregister.mockClear()
    deleteCache.mockClear()
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          getRegistrations: vi.fn(async () => [{ unregister }]),
        },
      },
    })
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn(async () => [
          'workbox-precache-v2-https://gridsolutions.app/',
        ]),
        delete: deleteCache,
      },
    })
  })

  afterEach(() => {
    // jsdom restores between files; leave clean for isolation
  })

  it('unregisters service workers and deletes cache storage keys', async () => {
    await clearGridServiceWorkerCaches()
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(deleteCache).toHaveBeenCalledWith(
      'workbox-precache-v2-https://gridsolutions.app/',
    )
  })
})
