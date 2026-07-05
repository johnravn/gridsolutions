import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  OFFER_EDITOR_AUTOSAVE_INTERVAL_MS,
  useOfferEditorAutosave,
} from './useOfferEditorAutosave'

describe('useOfferEditorAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not save when disabled', () => {
    const save = vi.fn()
    renderHook(() =>
      useOfferEditorAutosave({
        enabled: false,
        hasUnsavedChanges: () => true,
        isSaving: false,
        save,
      }),
    )

    vi.advanceTimersByTime(OFFER_EDITOR_AUTOSAVE_INTERVAL_MS)
    expect(save).not.toHaveBeenCalled()
  })

  it('saves after the interval when there are unsaved changes', () => {
    const save = vi.fn()
    renderHook(() =>
      useOfferEditorAutosave({
        enabled: true,
        hasUnsavedChanges: () => true,
        isSaving: false,
        save,
      }),
    )

    vi.advanceTimersByTime(OFFER_EDITOR_AUTOSAVE_INTERVAL_MS)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('skips save when there are no unsaved changes', () => {
    const save = vi.fn()
    renderHook(() =>
      useOfferEditorAutosave({
        enabled: true,
        hasUnsavedChanges: () => false,
        isSaving: false,
        save,
      }),
    )

    vi.advanceTimersByTime(OFFER_EDITOR_AUTOSAVE_INTERVAL_MS)
    expect(save).not.toHaveBeenCalled()
  })

  it('skips save while a save is already in progress', () => {
    const save = vi.fn()
    const { rerender } = renderHook(
      ({ isSaving }) =>
        useOfferEditorAutosave({
          enabled: true,
          hasUnsavedChanges: () => true,
          isSaving,
          save,
        }),
      { initialProps: { isSaving: true } },
    )

    vi.advanceTimersByTime(OFFER_EDITOR_AUTOSAVE_INTERVAL_MS)
    expect(save).not.toHaveBeenCalled()

    rerender({ isSaving: false })
    vi.advanceTimersByTime(OFFER_EDITOR_AUTOSAVE_INTERVAL_MS)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('respects canSave guard', () => {
    const save = vi.fn()
    renderHook(() =>
      useOfferEditorAutosave({
        enabled: true,
        hasUnsavedChanges: () => true,
        isSaving: false,
        canSave: () => false,
        save,
      }),
    )

    vi.advanceTimersByTime(OFFER_EDITOR_AUTOSAVE_INTERVAL_MS)
    expect(save).not.toHaveBeenCalled()
  })
})
