import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBlurFocusedDescendantWhenClosed } from './useBlurFocusedDescendantWhenClosed'

describe('useBlurFocusedDescendantWhenClosed', () => {
  it('blurs a focused descendant when the container closes', () => {
    const root = document.createElement('div')
    const button = document.createElement('button')
    root.appendChild(button)
    document.body.appendChild(root)

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => {
        const ref = useBlurFocusedDescendantWhenClosed<HTMLDivElement>(open)
        ref.current = root
        return ref
      },
      { initialProps: { open: true } },
    )

    button.focus()
    expect(document.activeElement).toBe(button)

    rerender({ open: false })
    expect(document.activeElement).not.toBe(button)

    root.remove()
  })

  it('leaves focus alone when the container stays open', () => {
    const root = document.createElement('div')
    const button = document.createElement('button')
    root.appendChild(button)
    document.body.appendChild(root)

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => {
        const ref = useBlurFocusedDescendantWhenClosed<HTMLDivElement>(open)
        ref.current = root
        return ref
      },
      { initialProps: { open: true } },
    )

    button.focus()
    rerender({ open: true })
    expect(document.activeElement).toBe(button)

    root.remove()
  })
})
