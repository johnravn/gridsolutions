import * as React from 'react'

export const OFFER_EDITOR_AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000

type UseOfferEditorAutosaveOptions = {
  /** When false, the interval is cleared and no saves are attempted. */
  enabled: boolean
  hasUnsavedChanges: () => boolean
  isSaving: boolean
  /** Return false to skip this tick (e.g. missing required fields). */
  canSave?: () => boolean
  save: () => void | Promise<void>
}

export function useOfferEditorAutosave({
  enabled,
  hasUnsavedChanges,
  isSaving,
  canSave = () => true,
  save,
}: UseOfferEditorAutosaveOptions) {
  const hasUnsavedChangesRef = React.useRef(hasUnsavedChanges)
  const canSaveRef = React.useRef(canSave)
  const saveRef = React.useRef(save)
  const isSavingRef = React.useRef(isSaving)

  hasUnsavedChangesRef.current = hasUnsavedChanges
  canSaveRef.current = canSave
  saveRef.current = save
  isSavingRef.current = isSaving

  React.useEffect(() => {
    if (!enabled) return

    const tick = () => {
      if (isSavingRef.current) return
      if (!canSaveRef.current()) return
      if (!hasUnsavedChangesRef.current()) return
      void saveRef.current()
    }

    const intervalId = window.setInterval(
      tick,
      OFFER_EDITOR_AUTOSAVE_INTERVAL_MS,
    )
    return () => window.clearInterval(intervalId)
  }, [enabled])
}
