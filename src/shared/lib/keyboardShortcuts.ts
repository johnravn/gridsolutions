import * as React from 'react'

export const TAB_KEYBOARD_SCOPE_ATTR = 'data-tab-keyboard-scope'

export function getModShortcutLabel(key: string): string {
  const normalizedKey = key.length === 1 ? key.toUpperCase() : key
  return isApplePlatform() ? `⌘${normalizedKey}` : `Ctrl+${normalizedKey}`
}

function isApplePlatform(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  )
}

export function getTabNavShortcutLabels(): { prev: string; next: string } {
  if (isApplePlatform()) {
    return { prev: '⌥←', next: '⌥→' }
  }
  return { prev: 'Alt+←', next: 'Alt+→' }
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true

  const tagName = el.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select')
    return true

  // Covers nested elements inside editors/inputs (e.g. wrappers).
  return !!el.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
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

function getOpenDialogs(): Array<HTMLElement> {
  return Array.from(
    document.querySelectorAll(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ),
  ).filter((el): el is HTMLElement => el instanceof HTMLElement)
}

function hasOpenDialog(): boolean {
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
  // Portaled dialogs (e.g. offer editors) sit outside page tab scopes in the DOM,
  // so block all tab shortcuts while any modal is open.
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
  const onTabChangeRef = React.useRef(onTabChange)
  onTabChangeRef.current = onTabChange

  const activeTabRef = React.useRef(activeTab)
  activeTabRef.current = activeTab

  React.useEffect(() => {
    if (!enabled || tabs.length <= 1) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return
      if (e.metaKey || e.ctrlKey || e.shiftKey) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (isEditableTarget(e.target)) return

      const scope = scopeRef.current
      if (!scope) return
      if (!shouldHandleTabKeyboardShortcut(e.target, scope)) return

      const currentIndex = tabs.indexOf(activeTabRef.current)
      if (currentIndex === -1) return

      e.preventDefault()

      const delta = e.key === 'ArrowRight' ? 1 : -1
      const nextIndex = (currentIndex + delta + tabs.length) % tabs.length
      onTabChangeRef.current(tabs[nextIndex])
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, scopeRef, tabs])
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
  React.useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      if (isEditableTarget(e.target)) return

      e.preventDefault()
      onTrigger()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, key, onTrigger])
}
