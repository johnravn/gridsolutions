import { describe, expect, it } from 'vitest'
import { asRegisterableHotkey } from './asRegisterableHotkey'

describe('asRegisterableHotkey', () => {
  it('returns the same string for TanStack Hotkeys registration', () => {
    expect(asRegisterableHotkey('Mod+Shift+J')).toBe('Mod+Shift+J')
    expect(asRegisterableHotkey('Alt+ArrowLeft')).toBe('Alt+ArrowLeft')
  })
})
