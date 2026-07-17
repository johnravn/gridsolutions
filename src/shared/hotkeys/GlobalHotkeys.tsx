import * as React from 'react'
import { useHotkeys } from '@tanstack/react-hotkeys'
import { useNavigate } from '@tanstack/react-router'
import { useAuthz } from '@shared/auth/useAuthz'
import { canVisit } from '@shared/auth/permissions'
import { hasOpenDialog } from '@shared/lib/keyboardShortcuts'
import { asRegisterableHotkey } from './asRegisterableHotkey'
import { useShortcutActions } from './ShortcutActionsProvider'
import { useResolvedShortcuts } from './ShortcutPreferencesProvider'
import { SHORTCUT_REGISTRY, isShortcutBound } from './shortcutRegistry'
import type { Capability } from '@shared/auth/permissions'
import type { ShortcutId } from './shortcutRegistry'

const NAV_IDS: Array<ShortcutId> = SHORTCUT_REGISTRY.filter((s) =>
  s.id.startsWith('nav.go'),
).map((s) => s.id)

const CREATE_IDS: Array<ShortcutId> = SHORTCUT_REGISTRY.filter((s) =>
  s.id.startsWith('create.'),
).map((s) => s.id)

const ROUTE_CAP: Record<string, Capability> = {
  '/dashboard': 'visit:home',
  '/latest': 'visit:latest',
  '/inventory': 'visit:inventory',
  '/vehicles': 'visit:vehicles',
  '/crew': 'visit:crew',
  '/jobs': 'visit:jobs',
  '/calendar': 'visit:calendar',
  '/logging': 'visit:logging',
  '/customers': 'visit:customers',
  '/matters': 'visit:matters',
  '/company': 'visit:company',
  '/reporting': 'visit:company',
  '/profile': 'visit:profile',
}

/**
 * Registers remappable navigation and create hotkeys app-wide.
 * Mount inside HotkeysProvider + ShortcutActionsProvider + auth context.
 */
export function GlobalHotkeys() {
  const resolved = useResolvedShortcuts()
  const navigate = useNavigate()
  const { caps, loading: authzLoading } = useAuthz()
  const { runAction } = useShortcutActions()

  const navHotkeys = React.useMemo(
    () =>
      NAV_IDS.flatMap((id) => {
        const hotkey = resolved[id]
        if (!isShortcutBound(hotkey)) return []
        const def = SHORTCUT_REGISTRY.find((s) => s.id === id)!
        const route = def.route!
        const cap = ROUTE_CAP[route]
        return [
          {
            hotkey: asRegisterableHotkey(hotkey),
            callback: () => {
              if (hasOpenDialog()) return
              // Registry routes are app paths; cast for typed router.
              void navigate({ to: route as never })
            },
            options: {
              enabled: !authzLoading && canVisit(caps, cap),
              preventDefault: true,
              ignoreInputs: true,
            },
          },
        ]
      }),
    [resolved, navigate, caps, authzLoading],
  )

  const createHotkeys = React.useMemo(
    () =>
      CREATE_IDS.flatMap((id) => {
        const hotkey = resolved[id]
        if (!isShortcutBound(hotkey)) return []
        return [
          {
            hotkey: asRegisterableHotkey(hotkey),
            callback: () => {
              if (hasOpenDialog()) return
              runAction(id)
            },
            options: {
              enabled: true,
              preventDefault: true,
              ignoreInputs: true,
            },
          },
        ]
      }),
    [resolved, runAction],
  )

  useHotkeys([...navHotkeys, ...createHotkeys])

  return null
}
