import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPwaUpdateFlow,
  resetPwaUpdateGuardsForTests,
} from './pwaUpdateFlow'
import { claimPwaRegistrationSlot } from './pwaUpdateGuards'

describe('createPwaUpdateFlow', () => {
  afterEach(() => {
    resetPwaUpdateGuardsForTests()
    vi.useRealTimers()
  })

  it('shows a sticky reload toast once when a new SW is waiting', () => {
    const showToast = vi.fn()
    const updateSW = vi.fn(async () => undefined)
    const flow = createPwaUpdateFlow({
      showToast,
      clearCaches: vi.fn(async () => undefined),
      reload: vi.fn(),
    })

    flow.onNeedRefresh(updateSW)
    flow.onNeedRefresh(updateSW)

    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'info',
        title: 'A new version is available',
        duration: 0,
        undoLabel: 'Reload',
        dedupeKey: 'pwa-need-refresh',
      }),
    )
  })

  it('does not stack toasts across separate flow instances (effect remount)', () => {
    const showToast = vi.fn()
    const updateSW = vi.fn(async () => undefined)
    const deps = {
      showToast,
      clearCaches: vi.fn(async () => undefined),
      reload: vi.fn(),
    }

    createPwaUpdateFlow(deps).onNeedRefresh(updateSW)
    createPwaUpdateFlow(deps).onNeedRefresh(updateSW)
    createPwaUpdateFlow(deps).onNeedRefresh(updateSW)

    expect(showToast).toHaveBeenCalledTimes(1)
  })

  it('keeps the session lock after many rapid needRefresh callbacks', () => {
    const showToast = vi.fn()
    const updateSW = vi.fn(async () => undefined)
    const flow = createPwaUpdateFlow({
      showToast,
      clearCaches: vi.fn(async () => undefined),
      reload: vi.fn(),
    })

    for (let i = 0; i < 50; i++) flow.onNeedRefresh(updateSW)

    expect(showToast).toHaveBeenCalledTimes(1)
  })

  it('forces a reload fallback after Reload even if updateSW hangs', async () => {
    vi.useFakeTimers()
    const showToast = vi.fn()
    const reload = vi.fn()
    const updateSW = vi.fn(() => new Promise<void>(() => {}))
    const flow = createPwaUpdateFlow({
      showToast,
      clearCaches: vi.fn(async () => undefined),
      reload,
    })

    flow.onNeedRefresh(updateSW)
    const onUndo = showToast.mock.calls[0]?.[0]?.onUndo as () => void
    onUndo()
    onUndo()

    expect(updateSW).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(600)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('offers a one-shot cache-clear reload on register error', async () => {
    const showToast = vi.fn()
    const clearCaches = vi.fn(async () => undefined)
    const reload = vi.fn()
    const flow = createPwaUpdateFlow({
      showToast,
      clearCaches,
      reload,
    })

    flow.onRegisterError()
    flow.onRegisterError()
    createPwaUpdateFlow({
      showToast,
      clearCaches,
      reload,
    }).onRegisterError()

    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: 'Could not update the app shell',
        undoLabel: 'Reload',
        dedupeKey: 'pwa-register-error',
      }),
    )

    const onUndo = showToast.mock.calls[0]?.[0]?.onUndo as () => void
    onUndo()
    await vi.waitFor(() => {
      expect(clearCaches).toHaveBeenCalledTimes(1)
      expect(reload).toHaveBeenCalledTimes(1)
    })
  })

  it('claims the SW registration slot only once per tab', () => {
    expect(claimPwaRegistrationSlot()).toBe(true)
    expect(claimPwaRegistrationSlot()).toBe(false)
    expect(claimPwaRegistrationSlot()).toBe(false)
  })
})
