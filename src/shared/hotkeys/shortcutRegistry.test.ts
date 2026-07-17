import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_BY_ID,
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_REGISTRY,
  findShortcutConflict,
  isShortcutBound,
  parseShortcutOverrides,
  resolveShortcuts,
  type ShortcutId,
} from './shortcutRegistry'

describe('SHORTCUT_REGISTRY', () => {
  it('has unique ids and unique non-null default hotkeys', () => {
    const ids = SHORTCUT_REGISTRY.map((s) => s.id)
    const hotkeys = SHORTCUT_REGISTRY.map((s) => s.defaultHotkey)
      .filter((h): h is string => h != null)
      .map((h) => h.toLowerCase())
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(hotkeys).size).toBe(hotkeys.length)
  })

  it('covers every ShortcutId and keeps BY_ID / DEFAULTS in sync', () => {
    const ids = Object.keys(SHORTCUT_BY_ID) as Array<ShortcutId>
    expect(ids.length).toBe(SHORTCUT_REGISTRY.length)
    for (const entry of SHORTCUT_REGISTRY) {
      expect(SHORTCUT_BY_ID[entry.id]).toEqual(entry)
      expect(DEFAULT_SHORTCUTS[entry.id]).toBe(entry.defaultHotkey)
    }
  })

  it('only premmaps sidebar, tab, and panel collapse by default', () => {
    const premapped = SHORTCUT_REGISTRY.filter((s) => s.defaultHotkey != null)
    expect(premapped.map((s) => s.id).sort()).toEqual(
      [
        'nav.sidebarNext',
        'nav.sidebarPrev',
        'nav.tabNext',
        'nav.tabPrev',
        'panel.collapse',
      ].sort(),
    )
  })

  it('requires routes for nav.go* entries', () => {
    for (const entry of SHORTCUT_REGISTRY) {
      if (entry.id.startsWith('nav.go')) {
        expect(entry.route).toMatch(/^\//)
      }
    }
  })

  it('labels every category', () => {
    const categories = new Set(SHORTCUT_REGISTRY.map((s) => s.category))
    for (const category of categories) {
      expect(SHORTCUT_CATEGORY_LABELS[category]).toBeTruthy()
    }
  })
})

describe('resolveShortcuts', () => {
  it('returns defaults when overrides are empty', () => {
    expect(resolveShortcuts({})).toEqual(DEFAULT_SHORTCUTS)
    expect(resolveShortcuts(null)).toEqual(DEFAULT_SHORTCUTS)
  })

  it('applies valid overrides over unbound defaults', () => {
    const resolved = resolveShortcuts({
      'panel.collapse': 'Mod+Shift+B',
      'create.job': 'Mod+J',
    })
    expect(resolved['panel.collapse']).toBe('Mod+Shift+B')
    expect(resolved['nav.tabNext']).toBe(DEFAULT_SHORTCUTS['nav.tabNext'])
    expect(resolved['create.job']).toBe('Mod+J')
    expect(resolved['create.customer']).toBe(null)
  })

  it('ignores unknown ids and empty strings', () => {
    const resolved = resolveShortcuts({
      'not.real': 'Mod+X',
      'panel.collapse': '   ',
    } as never)
    expect(resolved['panel.collapse']).toBe(DEFAULT_SHORTCUTS['panel.collapse'])
  })
})

describe('parseShortcutOverrides', () => {
  it('reads keyboard_shortcuts from preferences', () => {
    expect(
      parseShortcutOverrides({
        keyboard_shortcuts: { 'create.job': 'Mod+J' },
        notes: 'keep me',
      }),
    ).toEqual({ 'create.job': 'Mod+J' })
  })

  it('returns empty for missing or invalid prefs', () => {
    expect(parseShortcutOverrides(null)).toEqual({})
    expect(parseShortcutOverrides({ keyboard_shortcuts: 'nope' })).toEqual({})
  })
})

describe('isShortcutBound', () => {
  it('is false for null and blank', () => {
    expect(isShortcutBound(null)).toBe(false)
    expect(isShortcutBound('')).toBe(false)
    expect(isShortcutBound('   ')).toBe(false)
    expect(isShortcutBound('Mod+B')).toBe(true)
  })
})

describe('findShortcutConflict', () => {
  it('detects conflicting bindings case-insensitively', () => {
    const resolved = resolveShortcuts({ 'create.job': 'Mod+J' })
    expect(findShortcutConflict(resolved, 'create.customer', 'mod+j')).toBe(
      'create.job',
    )
    expect(findShortcutConflict(resolved, 'panel.collapse', 'Mod+B')).toBe(null)
  })

  it('ignores unbound shortcuts', () => {
    const resolved = resolveShortcuts({})
    expect(findShortcutConflict(resolved, 'create.job', 'Mod+J')).toBe(null)
  })
})
