import { describe, expect, it } from 'vitest'
import { toContentBox } from './AnimatedTabsList'

function mockRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this
    },
  }
}

describe('toContentBox', () => {
  it('adds scroll offsets so the underline stays in the scrolling content box', () => {
    const list = document.createElement('div')
    const target = document.createElement('button')
    list.getBoundingClientRect = () => mockRect(10, 20, 200, 40)
    target.getBoundingClientRect = () => mockRect(50, 20, 80, 40)
    Object.defineProperty(list, 'scrollLeft', { value: 40 })
    Object.defineProperty(list, 'scrollTop', { value: 0 })

    expect(toContentBox(list, target)).toEqual({
      x: 80,
      y: 0,
      width: 80,
      height: 40,
    })
  })
})
