import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  ShortcutActionsProvider,
  useRegisterShortcutAction,
  useShortcutActions,
} from './ShortcutActionsProvider'

function wrapper({ children }: { children: ReactNode }) {
  return <ShortcutActionsProvider>{children}</ShortcutActionsProvider>
}

describe('ShortcutActionsProvider', () => {
  it('throws when useShortcutActions is used outside the provider', () => {
    expect(() => renderHook(() => useShortcutActions())).toThrow(
      /must be used within ShortcutActionsProvider/,
    )
  })

  it('registers, runs, and unregisters actions', () => {
    const handler = vi.fn()
    const { result } = renderHook(() => useShortcutActions(), { wrapper })

    let unregister: (() => void) | undefined
    act(() => {
      unregister = result.current.registerAction('create.job', handler)
    })

    expect(result.current.hasAction('create.job')).toBe(true)
    expect(result.current.runAction('create.job')).toBe(true)
    expect(handler).toHaveBeenCalledOnce()

    act(() => {
      unregister?.()
    })

    expect(result.current.hasAction('create.job')).toBe(false)
    expect(result.current.runAction('create.job')).toBe(false)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('returns false when running an unregistered action', () => {
    const { result } = renderHook(() => useShortcutActions(), { wrapper })
    expect(result.current.runAction('create.customer')).toBe(false)
  })

  it('useRegisterShortcutAction registers while enabled and cleans up', () => {
    const handler = vi.fn()
    const { result, rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => {
        useRegisterShortcutAction('create.matter', handler, enabled)
        return useShortcutActions()
      },
      { wrapper, initialProps: { enabled: true } },
    )

    expect(result.current.hasAction('create.matter')).toBe(true)
    act(() => {
      expect(result.current.runAction('create.matter')).toBe(true)
    })
    expect(handler).toHaveBeenCalledOnce()

    rerender({ enabled: false })
    expect(result.current.hasAction('create.matter')).toBe(false)

    unmount()
    expect(result.current.hasAction('create.matter')).toBe(false)
  })

  it('useRegisterShortcutAction always calls the latest handler', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(
      ({ handler }: { handler: () => void }) => {
        useRegisterShortcutAction('create.vehicle', handler)
        return useShortcutActions()
      },
      { wrapper, initialProps: { handler: first } },
    )

    rerender({ handler: second })
    act(() => {
      result.current.runAction('create.vehicle')
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
