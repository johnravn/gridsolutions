import { Theme } from '@radix-ui/themes'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AppToastProvider, useToast } from './ToastProvider'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

function FireToast({ kind }: { kind: 'success' | 'error' | 'info' }) {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={() => {
        if (kind === 'success') toast.success('Saved', 'Time entry added')
        else if (kind === 'error')
          toast.error('Save failed', 'Please try again.')
        else toast.info('Copied to clipboard')
      }}
    >
      Fire
    </button>
  )
}

function renderToast(kind: 'success' | 'error' | 'info' = 'success') {
  return render(
    <Theme>
      <AppToastProvider>
        <FireToast kind={kind} />
      </AppToastProvider>
    </Theme>,
  )
}

describe('AppToastProvider', () => {
  it('shows a success toast', async () => {
    renderToast('success')
    fireEvent.click(screen.getByRole('button', { name: 'Fire' }))

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })
    expect(screen.getByText('Time entry added')).toBeInTheDocument()
    expect(document.querySelector('.app-toast')).toHaveAttribute(
      'data-kind',
      'success',
    )
    expect(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    ).toBeInTheDocument()
  })

  it('shows an error toast with the error kind', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderToast('error')
    fireEvent.click(screen.getByRole('button', { name: 'Fire' }))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
    expect(document.querySelector('.app-toast')).toHaveAttribute(
      'data-kind',
      'error',
    )
    errorSpy.mockRestore()
  })

  it('shows an info toast with the info kind', async () => {
    renderToast('info')
    fireEvent.click(screen.getByRole('button', { name: 'Fire' }))

    await waitFor(() => {
      expect(screen.getByText('Copied to clipboard')).toBeInTheDocument()
    })
    expect(document.querySelector('.app-toast')).toHaveAttribute(
      'data-kind',
      'info',
    )
  })
})
