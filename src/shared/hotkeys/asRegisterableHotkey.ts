import type { RegisterableHotkey } from '@tanstack/hotkeys'

/** User remaps are free-form strings; cast for TanStack Hotkeys registration. */
export function asRegisterableHotkey(hotkey: string): RegisterableHotkey {
  return hotkey as RegisterableHotkey
}
