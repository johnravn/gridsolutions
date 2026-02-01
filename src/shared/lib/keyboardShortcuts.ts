import * as React from 'react'

export function getModShortcutLabel(key: string): string {
  const normalizedKey = key.length === 1 ? key.toUpperCase() : key

  // iPadOS can report itself as Mac; this is just for a label.
  const isApplePlatform =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)

  return isApplePlatform ? `⌘${normalizedKey}` : `Ctrl+${normalizedKey}`
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
