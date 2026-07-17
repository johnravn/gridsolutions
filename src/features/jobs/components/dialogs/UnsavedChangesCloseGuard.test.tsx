import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { UnsavedChangesCloseGuard } from './UnsavedChangesCloseGuard'

describe('UnsavedChangesCloseGuard', () => {
  it('renders actions and wires button callbacks', () => {
    const onKeepEditing = vi.fn()
    const onDiscard = vi.fn()
    const onSaveAndClose = vi.fn()

    renderWithProviders(
      <UnsavedChangesCloseGuard
        open
        isSaving={false}
        onKeepEditing={onKeepEditing}
        onDiscard={onDiscard}
        onSaveAndClose={onSaveAndClose}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Unsaved changes' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onKeepEditing).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Save & close' }))
    expect(onSaveAndClose).toHaveBeenCalledTimes(1)
  })

  it('disables actions while saving and shows Saving…', () => {
    renderWithProviders(
      <UnsavedChangesCloseGuard
        open
        isSaving
        onKeepEditing={vi.fn()}
        onDiscard={vi.fn()}
        onSaveAndClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('disables Save & close when canSave is false', () => {
    renderWithProviders(
      <UnsavedChangesCloseGuard
        open
        isSaving={false}
        canSave={false}
        onKeepEditing={vi.fn()}
        onDiscard={vi.fn()}
        onSaveAndClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save & close' })).toBeDisabled()
  })

  it('does not dismiss when Escape is pressed', () => {
    const onKeepEditing = vi.fn()
    const onDiscard = vi.fn()
    const onSaveAndClose = vi.fn()

    renderWithProviders(
      <UnsavedChangesCloseGuard
        open
        isSaving={false}
        onKeepEditing={onKeepEditing}
        onDiscard={onDiscard}
        onSaveAndClose={onSaveAndClose}
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    expect(
      screen.getByRole('heading', { name: 'Unsaved changes' }),
    ).toBeInTheDocument()
    expect(onKeepEditing).not.toHaveBeenCalled()
    expect(onDiscard).not.toHaveBeenCalled()
    expect(onSaveAndClose).not.toHaveBeenCalled()
  })
})
