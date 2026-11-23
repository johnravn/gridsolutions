import { describe, expect, it, vi } from 'vitest'
import { createPwaUpdateFlow } from './pwaUpdateFlow'

describe('createPwaUpdateFlow', () => {
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
