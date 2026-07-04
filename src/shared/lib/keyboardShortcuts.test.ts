import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  getModShortcutLabel,
  isEditableTarget,
  useModKeyShortcut,
} from './keyboardShortcuts'

describe('getModShortcutLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses Cmd prefix on Apple platforms', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    expect(getModShortcutLabel('k')).toBe('⌘K')
    expect(getModShortcutLabel('S')).toBe('⌘S')
  })

  it('uses Ctrl prefix on other platforms', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    expect(getModShortcutLabel('k')).toBe('Ctrl+K')
  })
})

describe('isEditableTarget', () => {
  it('returns true for inputs and textareas', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
  })

  it('returns true for contenteditable elements', () => {
    const el = document.createElement('div')
    el.setAttribute('contenteditable', 'true')
    expect(isEditableTarget(el)).toBe(true)
  })

  it('returns true for nested elements inside inputs', () => {
    const wrapper = document.createElement('div')
    const input = document.createElement('input')
    wrapper.appendChild(input)
    const span = document.createElement('span')
    input.appendChild(span)
    expect(isEditableTarget(span)).toBe(true)
  })

  it('returns false for non-editable targets', () => {
    expect(isEditableTarget(document.createElement('button'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('useModKeyShortcut', () => {
  it('calls onTrigger for matching mod+key when not in editable target', () => {
    const onTrigger = vi.fn()
    renderHook(() => useModKeyShortcut({ key: 'k', enabled: true, onTrigger }))

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: document.body })
    window.dispatchEvent(event)
    expect(onTrigger).toHaveBeenCalledOnce()
  })

  it('does not trigger when disabled', () => {
    const onTrigger = vi.fn()
    renderHook(() => useModKeyShortcut({ key: 'k', enabled: false, onTrigger }))

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    )
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('does not trigger inside an input', () => {
    const onTrigger = vi.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    renderHook(() => useModKeyShortcut({ key: 'k', enabled: true, onTrigger }))

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    )
    expect(onTrigger).not.toHaveBeenCalled()
    input.remove()
  })
})
