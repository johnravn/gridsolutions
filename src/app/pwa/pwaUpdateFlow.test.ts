import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPwaUpdateFlow,
  resetPwaUpdateFlowGuardsForTests,
} from './pwaUpdateFlow'

describe('createPwaUpdateFlow', () => {
  afterEach(() => {
    resetPwaUpdateFlowGuardsForTests()
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
      }),
    )

    const onUndo = showToast.mock.calls[0]?.[0]?.onUndo as () => void
    onUndo()
    expect(updateSW).toHaveBeenCalledWith(true)
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
    // Simulates StrictMode / toast-context identity change remounting the
    // handler and creating a fresh flow while a waiting SW still exists.
    createPwaUpdateFlow(deps).onNeedRefresh(updateSW)
    createPwaUpdateFlow(deps).onNeedRefresh(updateSW)

    expect(showToast).toHaveBeenCalledTimes(1)
  })

  it('ignores Reload clicks while an update is already in flight', async () => {
    let resolveUpdate!: () => void
    const updateSW = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve
        }),
    )
    const showToast = vi.fn()
    const flow = createPwaUpdateFlow({
      showToast,
      clearCaches: vi.fn(async () => undefined),
      reload: vi.fn(),
    })

    flow.onNeedRefresh(updateSW)
    const onUndo = showToast.mock.calls[0]?.[0]?.onUndo as () => void
    onUndo()
    onUndo()
    onUndo()

    expect(updateSW).toHaveBeenCalledTimes(1)
    resolveUpdate()
    await vi.waitFor(() => {
      expect(updateSW).toHaveBeenCalledTimes(1)
    })

    // Same toast may retry after a failed/no-reload update; still no second toast.
    onUndo()
    expect(updateSW).toHaveBeenCalledTimes(2)
    expect(showToast).toHaveBeenCalledTimes(1)
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
      }),
    )

    const onUndo = showToast.mock.calls[0]?.[0]?.onUndo as () => void
    onUndo()
    await vi.waitFor(() => {
      expect(clearCaches).toHaveBeenCalledTimes(1)
      expect(reload).toHaveBeenCalledTimes(1)
    })
  })
})
