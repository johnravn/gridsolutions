/**
 * Detects hotkeys that commonly conflict with browser or OS shortcuts.
 * Matching is order-insensitive and treats Meta/Ctrl as Mod.
 */

export type SystemShortcutWarning = {
  /** Canonical hotkey that matched (display uses the user's chord). */
  match: string
  /** Short explanation of the conflict. */
  reason: string
}

const COMMON_SYSTEM_SHORTCUTS: ReadonlyArray<SystemShortcutWarning> = [
  { match: 'Mod+A', reason: 'Select all' },
  { match: 'Mod+C', reason: 'Copy' },
  { match: 'Mod+V', reason: 'Paste' },
  { match: 'Mod+X', reason: 'Cut' },
  { match: 'Mod+Z', reason: 'Undo' },
  { match: 'Mod+Shift+Z', reason: 'Redo' },
  { match: 'Mod+Y', reason: 'Redo (Windows/Linux)' },
  { match: 'Mod+S', reason: 'Save' },
  { match: 'Mod+P', reason: 'Print' },
  { match: 'Mod+F', reason: 'Find in page' },
  { match: 'Mod+G', reason: 'Find next' },
  { match: 'Mod+Shift+G', reason: 'Find previous' },
  { match: 'Mod+N', reason: 'New browser window' },
  { match: 'Mod+Shift+N', reason: 'New private/incognito window' },
  { match: 'Mod+T', reason: 'New browser tab' },
  { match: 'Mod+Shift+T', reason: 'Reopen closed tab' },
  { match: 'Mod+W', reason: 'Close tab' },
  { match: 'Mod+Shift+W', reason: 'Close window' },
  { match: 'Mod+R', reason: 'Reload page' },
  { match: 'Mod+Shift+R', reason: 'Hard reload' },
  { match: 'Mod+L', reason: 'Focus address bar' },
  { match: 'Mod+D', reason: 'Bookmark page' },
  { match: 'Mod+H', reason: 'Hide window / History (platform-dependent)' },
  { match: 'Mod+M', reason: 'Minimize window' },
  { match: 'Mod+Q', reason: 'Quit application' },
  { match: 'Mod+,', reason: 'App settings (macOS)' },
  { match: 'Mod+Tab', reason: 'Switch applications (OS)' },
  { match: 'Alt+Tab', reason: 'Switch applications (OS)' },
  { match: 'Mod+`', reason: 'Cycle windows (macOS)' },
  { match: 'Mod+Space', reason: 'Spotlight / system search' },
  { match: 'Alt+Space', reason: 'Window menu (Windows)' },
  { match: 'Mod+Shift+Delete', reason: 'Clear browsing data' },
  { match: 'Mod+Shift+I', reason: 'Developer tools' },
  { match: 'Mod+Alt+I', reason: 'Developer tools' },
  { match: 'Mod+Option+I', reason: 'Developer tools' },
  { match: 'F5', reason: 'Reload page' },
  { match: 'F11', reason: 'Fullscreen' },
  { match: 'F12', reason: 'Developer tools' },
  { match: 'Mod+1', reason: 'Switch to browser tab 1' },
  { match: 'Mod+2', reason: 'Switch to browser tab 2' },
  { match: 'Mod+3', reason: 'Switch to browser tab 3' },
  { match: 'Mod+4', reason: 'Switch to browser tab 4' },
  { match: 'Mod+5', reason: 'Switch to browser tab 5' },
  { match: 'Mod+6', reason: 'Switch to browser tab 6' },
  { match: 'Mod+7', reason: 'Switch to browser tab 7' },
  { match: 'Mod+8', reason: 'Switch to browser tab 8' },
  { match: 'Mod+9', reason: 'Switch to last browser tab' },
]

function normalizeHotkey(hotkey: string): string {
  const parts = hotkey
    .trim()
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (
        part === 'meta' ||
        part === 'cmd' ||
        part === 'command' ||
        part === 'ctrl' ||
        part === 'control'
      ) {
        return 'mod'
      }
      if (part === 'option') return 'alt'
      if (part === 'return') return 'enter'
      if (part === 'esc') return 'escape'
      return part
    })

  const modifiers = ['mod', 'alt', 'shift'].filter((m) => parts.includes(m))
  const keys = parts.filter((p) => p !== 'mod' && p !== 'alt' && p !== 'shift')
  return [...modifiers, ...keys].join('+')
}

const NORMALIZED_LOOKUP = new Map(
  COMMON_SYSTEM_SHORTCUTS.map((entry) => [
    normalizeHotkey(entry.match),
    entry,
  ]),
)

/** Returns a warning when the hotkey is commonly reserved by the browser or OS. */
export function getSystemShortcutWarning(
  hotkey: string,
): SystemShortcutWarning | null {
  if (!hotkey.trim()) return null
  return NORMALIZED_LOOKUP.get(normalizeHotkey(hotkey)) ?? null
}
