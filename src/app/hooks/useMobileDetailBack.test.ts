import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMobileDetailBack } from './useMobileDetailBack'

describe('useMobileDetailBack', () => {
  it('pushes a dummy history entry while open and pops it on close', () => {
    const onClose = () => {}
    const back = vi.spyOn(window.history, 'back')

    const { rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useMobileDetailBack(true, isOpen, onClose),
      { initialProps: { isOpen: false } },
    )

    act(() => {
      rerender({ isOpen: true })
    })
    expect(window.history.state).toEqual({ gridMobileDetail: true })

    act(() => {
      rerender({ isOpen: false })
    })
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })

  it('releaseTrap drops the dummy entry so close does not call history.back', () => {
    const onClose = () => {}
    const back = vi.spyOn(window.history, 'back')
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useMobileDetailBack(true, isOpen, onClose),
      { initialProps: { isOpen: true } },
    )

    expect(window.history.state).toEqual({ gridMobileDetail: true })

    act(() => {
      result.current.releaseTrap()
    })
    expect(window.history.state).not.toEqual({ gridMobileDetail: true })

    act(() => {
      rerender({ isOpen: false })
    })
    expect(back).not.toHaveBeenCalled()
    back.mockRestore()
  })
})
