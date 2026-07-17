/**
 * Tab-scope helpers and remappable hotkey hooks backed by TanStack Hotkeys.
 * Display labels use formatForDisplay; bindings come from the shortcut registry.
 */
import * as React from 'react'
import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys'
import { asRegisterableHotkey } from '@shared/hotkeys/asRegisterableHotkey'
import { useResolvedShortcuts } from '@shared/hotkeys/ShortcutPreferencesProvider'
import { isShortcutBound } from '@shared/hotkeys/shortcutRegistry'

export const TAB_KEYBOARD_SCOPE_ATTR = 'data-tab-keyboard-scope'

export function getModShortcutLabel(key: string): string {
  const normalizedKey = key.length === 1 ? key.toUpperCase() : key
  return formatForDisplay(`Mod+${normalizedKey}`)
}

export function getTabNavShortcutLabels(resolved?: {
  prev: string | null
  next: string | null
}): { prev: string; next: string } {
  const prev = resolved?.prev ?? 'Alt+ArrowLeft'
  const next = resolved?.next ?? 'Alt+ArrowRight'
  return {
    prev: formatForDisplay(prev),
    next: formatForDisplay(next),
  }
}

export function formatShortcut(hotkey: string): string {
  return formatForDisplay(hotkey)
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true

  const tagName = el.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select')
    return true

  return !!el.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  )
}

/** Blocks sidebar nav only in multiline / rich editors where Shift+↑↓ selects text. */
export function isSidebarNavBlockedTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true

  const tagName = el.tagName.toLowerCase()
  if (tagName === 'textarea' || tagName === 'select') return true

  return !!el.closest(
    'textarea, select, [contenteditable="true"], [role="textbox"]',
  )
}

function getInnermostTabScope(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest(`[${TAB_KEYBOARD_SCOPE_ATTR}]`)
}

function isVisibleTabScope(el: HTMLElement): boolean {
  if (!el.isConnected) return false
  if (el.getClientRects().length > 0) return true

  const style = getComputedStyle(el)
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    !el.closest('[hidden]')
  )
}

export function getOpenDialogs(): Array<HTMLElement> {
  return Array.from(
    document.querySelectorAll(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ),
  ).filter((el): el is HTMLElement => el instanceof HTMLElement)
}

export function hasOpenDialog(): boolean {
  return getOpenDialogs().length > 0
}

function getDeepestVisibleTabScope(): HTMLElement | null {
  const scopes = Array.from(
    document.querySelectorAll(`[${TAB_KEYBOARD_SCOPE_ATTR}]`),
  ).filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && isVisibleTabScope(el),
  )

  return (
    scopes.find(
      (scope) =>
        !scopes.some((other) => other !== scope && scope.contains(other)),
    ) ?? null
  )
}

export function shouldHandleTabKeyboardShortcut(
  target: EventTarget | null,
  scope: HTMLElement,
): boolean {
  if (hasOpenDialog()) return false

  const innermost = getInnermostTabScope(target)

  if (innermost) {
    if (innermost === scope) return true
    if (scope.contains(innermost)) return false
    return false
  }

  return getDeepestVisibleTabScope() === scope
}

export function useTabKeyboardScopeProps<
  T extends HTMLElement = HTMLDivElement,
>({ enabled = true }: { enabled?: boolean } = {}) {
  const scopeRef = React.useRef<T | null>(null)
  const ref = React.useCallback(
    (node: T | null) => {
      scopeRef.current = node
      if (!node) return
      if (enabled) {
        node.setAttribute(TAB_KEYBOARD_SCOPE_ATTR, '')
      } else {
        node.removeAttribute(TAB_KEYBOARD_SCOPE_ATTR)
      }
    },
    [enabled],
  )

  return {
    scopeRef,
    scopeProps: enabled
      ? ({
          ref,
          [TAB_KEYBOARD_SCOPE_ATTR]: '',
        } as { ref: (node: T | null) => void } & Record<
          typeof TAB_KEYBOARD_SCOPE_ATTR,
          ''
        >)
      : ({ ref } as { ref: (node: T | null) => void }),
  }
}

export function useTabKeyboardShortcuts({
  scopeRef,
  tabs,
  activeTab,
  onTabChange,
  enabled = true,
}: {
  scopeRef: React.RefObject<HTMLElement | null>
  tabs: ReadonlyArray<string>
  activeTab: string
  onTabChange: (tab: string) => void
  enabled?: boolean
}) {
  const resolved = useResolvedShortcuts()
  const onTabChangeRef = React.useRef(onTabChange)
  onTabChangeRef.current = onTabChange

  const activeTabRef = React.useRef(activeTab)
  activeTabRef.current = activeTab

  const tabsRef = React.useRef(tabs)
  tabsRef.current = tabs

  const canRun = enabled && tabs.length > 1
  const prevHotkey = resolved['nav.tabPrev']
  const nextHotkey = resolved['nav.tabNext']

  const tryChange = React.useCallback(
    (delta: number, event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const scope = scopeRef.current
      if (!scope) return
      if (!shouldHandleTabKeyboardShortcut(event.target, scope)) return

      const currentIndex = tabsRef.current.indexOf(activeTabRef.current)
      if (currentIndex === -1) return

      const nextIndex =
        (currentIndex + delta + tabsRef.current.length) % tabsRef.current.length
      onTabChangeRef.current(tabsRef.current[nextIndex])
    },
    [scopeRef],
  )

  useHotkey(
    asRegisterableHotkey(prevHotkey ?? 'Alt+ArrowLeft'),
    (event) => tryChange(-1, event),
    {
      enabled: canRun && isShortcutBound(prevHotkey),
      preventDefault: true,
      ignoreInputs: true,
    },
  )

  useHotkey(
    asRegisterableHotkey(nextHotkey ?? 'Alt+ArrowRight'),
    (event) => tryChange(1, event),
    {
      enabled: canRun && isShortcutBound(nextHotkey),
      preventDefault: true,
      ignoreInputs: true,
    },
  )
}

export function useModKeyShortcut({
  key,
  enabled = true,
  onTrigger,
}: {
  key: string
  enabled?: boolean
  onTrigger: () => void
}) {
  const resolved = useResolvedShortcuts()
  // Legacy API: key 'b' maps to panel.collapse when that is the historical binding
  const hotkey =
    key.toLowerCase() === 'b' ? resolved['panel.collapse'] : `Mod+${key}`

  useHotkey(
    asRegisterableHotkey(hotkey ?? 'Mod+B'),
    () => {
      onTrigger()
    },
    {
      enabled: enabled && isShortcutBound(hotkey),
      preventDefault: true,
      ignoreInputs: true,
    },
  )
}

export function usePanelCollapseShortcut({
  enabled = true,
  onTrigger,
}: {
  enabled?: boolean
  onTrigger: () => void
}) {
  const resolved = useResolvedShortcuts()
  const hotkey = resolved['panel.collapse']
  useHotkey(
    asRegisterableHotkey(hotkey ?? 'Mod+B'),
    () => {
      onTrigger()
    },
    {
      enabled: enabled && isShortcutBound(hotkey),
      preventDefault: true,
      ignoreInputs: true,
    },
  )
}

export function findSidebarNavIndex(
  routes: ReadonlyArray<string>,
  currentPath: string,
): number {
  const exact = routes.findIndex((to) => currentPath === to)
  if (exact !== -1) return exact

  let best = -1
  let bestLen = -1
  routes.forEach((to, index) => {
    if (currentPath.startsWith(`${to}/`) && to.length > bestLen) {
      best = index
      bestLen = to.length
    }
  })
  return best
}

/** Cycles sidebar destinations with remappable Alt+Arrow shortcuts. */
export function useSidebarNavKeyboardShortcut({
  routes,
  currentPath,
  onNavigate,
  enabled = true,
}: {
  routes: ReadonlyArray<string>
  currentPath: string
  onNavigate: (to: string) => void
  enabled?: boolean
}) {
  const resolved = useResolvedShortcuts()
  const onNavigateRef = React.useRef(onNavigate)
  onNavigateRef.current = onNavigate

  const currentPathRef = React.useRef(currentPath)
  currentPathRef.current = currentPath

  const routesRef = React.useRef(routes)
  routesRef.current = routes

  const canRun = enabled && routes.length > 1
  const prevHotkey = resolved['nav.sidebarPrev']
  const nextHotkey = resolved['nav.sidebarNext']

  const go = React.useCallback((delta: number, event: KeyboardEvent) => {
    if (isSidebarNavBlockedTarget(event.target)) return
    if (hasOpenDialog()) return

    const currentIndex = findSidebarNavIndex(
      routesRef.current,
      currentPathRef.current,
    )
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + delta + routesRef.current.length) %
          routesRef.current.length
    const nextRoute = routesRef.current[nextIndex]
    if (!nextRoute) return
    onNavigateRef.current(nextRoute)
  }, [])

  useHotkey(
    asRegisterableHotkey(prevHotkey ?? 'Alt+ArrowUp'),
    (event) => go(-1, event),
    {
      enabled: canRun && isShortcutBound(prevHotkey),
      preventDefault: true,
      // Allow in single-line inputs (e.g. logging job search autofocus);
      // isSidebarNavBlockedTarget still blocks textareas / rich editors.
      ignoreInputs: false,
    },
  )

  useHotkey(
    asRegisterableHotkey(nextHotkey ?? 'Alt+ArrowDown'),
    (event) => go(1, event),
    {
      enabled: canRun && isShortcutBound(nextHotkey),
      preventDefault: true,
      ignoreInputs: false,
    },
  )
}
