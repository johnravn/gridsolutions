import { describe, expect, it } from 'vitest'
import { getSystemShortcutWarning } from './systemShortcutWarnings'

describe('getSystemShortcutWarning', () => {
  it('flags common browser and OS shortcuts', () => {
    expect(getSystemShortcutWarning('Mod+T')?.reason).toMatch(/tab/i)
    expect(getSystemShortcutWarning('Mod+S')?.reason).toMatch(/save/i)
    expect(getSystemShortcutWarning('F12')?.reason).toMatch(/developer/i)
  })

  it('normalizes Meta/Ctrl and modifier order', () => {
    expect(getSystemShortcutWarning('Meta+Shift+T')?.match).toBe('Mod+Shift+T')
    expect(getSystemShortcutWarning('Ctrl+C')?.match).toBe('Mod+C')
    expect(getSystemShortcutWarning('Shift+Mod+Z')?.match).toBe('Mod+Shift+Z')
  })

  it('returns null for uncommon app shortcuts', () => {
    expect(getSystemShortcutWarning('Alt+ArrowDown')).toBe(null)
    expect(getSystemShortcutWarning('Mod+Shift+J')).toBe(null)
    expect(getSystemShortcutWarning('')).toBe(null)
  })
})
