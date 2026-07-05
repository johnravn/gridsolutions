import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  getModShortcutLabel,
  getTabNavShortcutLabels,
  isEditableTarget,
  TAB_KEYBOARD_SCOPE_ATTR,
  useModKeyShortcut,
  useTabKeyboardScopeProps,
  useTabKeyboardShortcuts,
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

describe('getTabNavShortcutLabels', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses Option arrows on Apple platforms', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    expect(getTabNavShortcutLabels()).toEqual({ prev: '⌥←', next: '⌥→' })
  })

  it('uses Alt arrows on other platforms', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    expect(getTabNavShortcutLabels()).toEqual({ prev: 'Alt+←', next: 'Alt+→' })
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

describe('useTabKeyboardShortcuts', () => {
  const tabs = ['one', 'two', 'three'] as const

  function mountTabShortcutHarness({
    activeTab = 'two',
    onTabChange = vi.fn(),
    enabled = true,
  }: {
    activeTab?: string
    onTabChange?: (tab: string) => void
    enabled?: boolean
  } = {}) {
    const onTabChangeRef = { current: onTabChange }

    const { result, unmount } = renderHook(() => {
      const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
      useTabKeyboardShortcuts({
        scopeRef,
        tabs,
        activeTab,
        onTabChange: (tab) => onTabChangeRef.current(tab),
        enabled,
      })
      return { scopeRef, scopeProps }
    })

    const scope = document.createElement('div')
    scope.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
    result.current.scopeProps.ref(scope)
    document.body.appendChild(scope)

    return {
      scope,
      onTabChange: onTabChangeRef,
      unmount: () => {
        scope.remove()
        unmount()
      },
    }
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('moves to the next tab on Alt+ArrowRight inside scope', () => {
    const onTabChange = vi.fn()
    const harness = mountTabShortcutHarness({ onTabChange })

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: harness.scope })
    window.dispatchEvent(event)

    expect(onTabChange).toHaveBeenCalledWith('three')
    harness.unmount()
  })

  it('moves to the previous tab on Alt+ArrowLeft inside scope', () => {
    const onTabChange = vi.fn()
    const harness = mountTabShortcutHarness({ onTabChange })

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      altKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: harness.scope })
    window.dispatchEvent(event)

    expect(onTabChange).toHaveBeenCalledWith('one')
    harness.unmount()
  })

  it('triggers when focus is outside the tab scope but it is the active tab group', () => {
    const onTabChange = vi.fn()
    const harness = mountTabShortcutHarness({ onTabChange })

    const outside = document.createElement('div')
    document.body.appendChild(outside)

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: outside })
    window.dispatchEvent(event)

    expect(onTabChange).toHaveBeenCalledWith('three')
    harness.unmount()
  })

  it('prefers the innermost tab scope when focus is inside it', () => {
    const outerOnTabChange = vi.fn()
    const innerOnTabChange = vi.fn()

    const { result: outerResult, unmount: unmountOuter } = renderHook(() => {
      const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
      useTabKeyboardShortcuts({
        scopeRef,
        tabs: ['outer-a', 'outer-b'],
        activeTab: 'outer-a',
        onTabChange: outerOnTabChange,
      })
      return scopeProps
    })

    const { result: innerResult, unmount: unmountInner } = renderHook(() => {
      const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
      useTabKeyboardShortcuts({
        scopeRef,
        tabs: ['inner-a', 'inner-b'],
        activeTab: 'inner-a',
        onTabChange: innerOnTabChange,
      })
      return scopeProps
    })

    const outer = document.createElement('div')
    outer.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
    outerResult.current.ref(outer)
    document.body.appendChild(outer)

    const inner = document.createElement('div')
    inner.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
    innerResult.current.ref(inner)
    outer.appendChild(inner)

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: inner })
    window.dispatchEvent(event)

    expect(innerOnTabChange).toHaveBeenCalledWith('inner-b')
    expect(outerOnTabChange).not.toHaveBeenCalled()

    unmountInner()
    unmountOuter()
  })

  it('uses the deepest visible tab scope when focus is not inside a tab group', () => {
    const outerOnTabChange = vi.fn()
    const innerOnTabChange = vi.fn()

    const { result: outerResult, unmount: unmountOuter } = renderHook(() => {
      const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
      useTabKeyboardShortcuts({
        scopeRef,
        tabs: ['outer-a', 'outer-b'],
        activeTab: 'outer-a',
        onTabChange: outerOnTabChange,
      })
      return scopeProps
    })

    const { result: innerResult, unmount: unmountInner } = renderHook(() => {
      const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
      useTabKeyboardShortcuts({
        scopeRef,
        tabs: ['inner-a', 'inner-b'],
        activeTab: 'inner-a',
        onTabChange: innerOnTabChange,
      })
      return scopeProps
    })

    const outer = document.createElement('div')
    outer.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
    outerResult.current.ref(outer)
    document.body.appendChild(outer)

    const inner = document.createElement('div')
    inner.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
    innerResult.current.ref(inner)
    outer.appendChild(inner)

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: document.body })
    window.dispatchEvent(event)

    expect(innerOnTabChange).toHaveBeenCalledWith('inner-b')
    expect(outerOnTabChange).not.toHaveBeenCalled()

    unmountInner()
    unmountOuter()
  })

  it('does not trigger while an open dialog is on screen', () => {
    const onTabChange = vi.fn()
    const harness = mountTabShortcutHarness({ onTabChange })

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    document.body.appendChild(dialog)

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: dialog })
    window.dispatchEvent(event)

    expect(onTabChange).not.toHaveBeenCalled()
    dialog.remove()
    harness.unmount()
  })

  it('does not block parent tab shortcuts when disabled', () => {
    const parentOnTabChange = vi.fn()
    const childOnTabChange = vi.fn()

    const { result: parentResult, unmount: unmountParent } = renderHook(() => {
      const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
      useTabKeyboardShortcuts({
        scopeRef,
        tabs: ['parent-a', 'parent-b'],
        activeTab: 'parent-a',
        onTabChange: parentOnTabChange,
      })
      return scopeProps
    })

    const { result: childResult, unmount: unmountChild } = renderHook(() => {
      const { scopeRef, scopeProps } = useTabKeyboardScopeProps({
        enabled: false,
      })
      useTabKeyboardShortcuts({
        scopeRef,
        tabs: ['child-a', 'child-b'],
        activeTab: 'child-a',
        onTabChange: childOnTabChange,
        enabled: false,
      })
      return scopeProps
    })

    const parent = document.createElement('div')
    parent.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
    parentResult.current.ref(parent)
    document.body.appendChild(parent)

    const child = document.createElement('div')
    childResult.current.ref(child)
    parent.appendChild(child)

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: child })
    window.dispatchEvent(event)

    expect(parentOnTabChange).toHaveBeenCalledWith('parent-b')
    expect(childOnTabChange).not.toHaveBeenCalled()

    unmountChild()
    unmountParent()
  })
})
