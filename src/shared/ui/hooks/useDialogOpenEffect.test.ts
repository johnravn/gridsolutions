import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDialogOpenEffect } from './useDialogOpenEffect'

describe('useDialogOpenEffect', () => {
  it('runs onOpen when open becomes true', () => {
    const onOpen = vi.fn()
    const { rerender } = renderHook(
      ({ open }) => useDialogOpenEffect(open, onOpen),
      { initialProps: { open: false } },
    )
    expect(onOpen).not.toHaveBeenCalled()
    rerender({ open: true })
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('re-runs when resetKeys change while open', () => {
    const onOpen = vi.fn()
    const { rerender } = renderHook(
      ({ open, id }) => useDialogOpenEffect(open, onOpen, [id]),
      { initialProps: { open: true, id: 'a' } },
    )
    expect(onOpen).toHaveBeenCalledTimes(1)
    rerender({ open: true, id: 'b' })
    expect(onOpen).toHaveBeenCalledTimes(2)
  })
})
