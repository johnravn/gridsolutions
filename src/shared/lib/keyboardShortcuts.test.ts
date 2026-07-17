import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  findSidebarNavIndex,
  formatShortcut,
  getModShortcutLabel,
  getOpenDialogs,
  getTabNavShortcutLabels,
  hasOpenDialog,
  isEditableTarget,
  isSidebarNavBlockedTarget,
  shouldHandleTabKeyboardShortcut,
  TAB_KEYBOARD_SCOPE_ATTR,
  useTabKeyboardScopeProps,
} from './keyboardShortcuts'

vi.mock('@tanstack/react-hotkeys', async () => {
  const actual = await vi.importActual<
    typeof import('@tanstack/react-hotkeys')
  >('@tanstack/react-hotkeys')
  return {
    ...actual,
    useHotkey: vi.fn(),
  }
})

describe('getModShortcutLabel', () => {
  it('formats Mod+key via formatForDisplay', () => {
    expect(getModShortcutLabel('k')).toBe(formatShortcut('Mod+K'))
    expect(getModShortcutLabel('B')).toBe(formatShortcut('Mod+B'))
  })
})

describe('getTabNavShortcutLabels', () => {
  it('formats default alt-arrow bindings', () => {
    expect(getTabNavShortcutLabels()).toEqual({
      prev: formatShortcut('Alt+ArrowLeft'),
      next: formatShortcut('Alt+ArrowRight'),
    })
  })

  it('formats custom bindings when provided', () => {
    expect(
      getTabNavShortcutLabels({
        prev: 'Mod+ArrowLeft',
        next: 'Mod+ArrowRight',
      }),
    ).toEqual({
      prev: formatShortcut('Mod+ArrowLeft'),
      next: formatShortcut('Mod+ArrowRight'),
    })
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

describe('isSidebarNavBlockedTarget', () => {
  it('allows single-line inputs so search autofocus does not block nav', () => {
    expect(isSidebarNavBlockedTarget(document.createElement('input'))).toBe(
      false,
    )
  })

  it('blocks textareas and contenteditable', () => {
    expect(isSidebarNavBlockedTarget(document.createElement('textarea'))).toBe(
      true,
    )
    const el = document.createElement('div')
    el.setAttribute('contenteditable', 'true')
    expect(isSidebarNavBlockedTarget(el)).toBe(true)
  })
})

describe('useTabKeyboardScopeProps', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('attaches the tab scope attribute when enabled', () => {
    const { result } = renderHook(() => useTabKeyboardScopeProps())
    const el = document.createElement('div')
    result.current.scopeProps.ref(el)
    expect(el.hasAttribute(TAB_KEYBOARD_SCOPE_ATTR)).toBe(true)
  })
})

describe('shouldHandleTabKeyboardShortcut', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns false when a dialog is open', () => {
    const scope = document.createElement('div')
    scope.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
    document.body.appendChild(scope)

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    document.body.appendChild(dialog)

    expect(shouldHandleTabKeyboardShortcut(scope, scope)).toBe(false)
  })

  it('returns true when focus is inside the scope and no dialog', () => {
    const scope = document.createElement('div')
    scope.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
    document.body.appendChild(scope)
    expect(shouldHandleTabKeyboardShortcut(scope, scope)).toBe(true)
  })
})

describe('hasOpenDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('detects open dialogs and alertdialogs', () => {
    expect(hasOpenDialog()).toBe(false)
    expect(getOpenDialogs()).toEqual([])

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    document.body.appendChild(dialog)

    expect(hasOpenDialog()).toBe(true)
    expect(getOpenDialogs()).toHaveLength(1)
  })

  it('ignores closed dialogs', () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'closed')
    document.body.appendChild(dialog)

    expect(hasOpenDialog()).toBe(false)
  })
})

describe('findSidebarNavIndex', () => {
  it('prefers exact match then longest prefix', () => {
    const routes = ['/jobs', '/jobs/recurring', '/calendar']
    expect(findSidebarNavIndex(routes, '/jobs')).toBe(0)
    expect(findSidebarNavIndex(routes, '/jobs/recurring/1')).toBe(1)
    expect(findSidebarNavIndex(routes, '/unknown')).toBe(-1)
  })
})
