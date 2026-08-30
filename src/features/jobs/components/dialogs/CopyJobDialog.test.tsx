import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import CopyJobDialog, { getCopyJobInitialFormValues } from './CopyJobDialog'

const START = '2026-03-10T08:00:00.000Z'

describe('getCopyJobInitialFormValues', () => {
  it('keeps the source job title and start time', () => {
    expect(
      getCopyJobInitialFormValues({
        title: 'Summer festival',
        startAt: START,
      }),
    ).toEqual({
      title: 'Summer festival',
      startAt: START,
    })
  })

  it('falls back to empty strings when the source job has no values', () => {
    expect(
      getCopyJobInitialFormValues({
        title: null,
        startAt: null,
      }),
    ).toEqual({
      title: '',
      startAt: '',
    })
  })
})

describe('CopyJobDialog', () => {
  it('prefills the source title and start, then copies them', async () => {
    const onConfirm = vi.fn()

    renderWithProviders(
      <CopyJobDialog
        open
        onOpenChange={vi.fn()}
        initialTitle="Summer festival"
        initialStartAt={START}
        onConfirm={onConfirm}
        isCopying={false}
      />,
    )

    const title = await screen.findByLabelText('Title')
    await waitFor(() => expect(title).toHaveValue('Summer festival'))

    fireEvent.click(screen.getByRole('button', { name: 'Copy job' }))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        title: 'Summer festival',
        startAt: START,
      })
    })
  })

  it('submits an edited title with the same start time', async () => {
    const onConfirm = vi.fn()

    renderWithProviders(
      <CopyJobDialog
        open
        onOpenChange={vi.fn()}
        initialTitle="Summer festival"
        initialStartAt={START}
        onConfirm={onConfirm}
        isCopying={false}
      />,
    )

    const title = await screen.findByLabelText('Title')
    await waitFor(() => expect(title).toHaveValue('Summer festival'))
    fireEvent.change(title, { target: { value: 'Summer festival 2027' } })

    fireEvent.click(screen.getByRole('button', { name: 'Copy job' }))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        title: 'Summer festival 2027',
        startAt: START,
      })
    })
  })
})
