import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { z } from 'zod'
import { renderWithProviders } from '@test/render'
import { useAppForm } from './formHook'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  notes: z.string(),
})

function TestForm({
  onSubmit,
}: {
  onSubmit: (value: { name: string; notes: string }) => void | Promise<void>
}) {
  const form = useAppForm({
    defaultValues: { name: '', notes: '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <form.AppForm>
        <form.AppField name="name">
          {(field) => <field.TextField label="Name" />}
        </form.AppField>
        <form.AppField name="notes">
          {(field) => <field.TextArea label="Notes" />}
        </form.AppField>
        <form.SubmitButton label="Save" pendingLabel="Saving…" />
      </form.AppForm>
    </form>
  )
}

describe('useAppForm', () => {
  it('blocks submit when zod validation fails', async () => {
    const onSubmit = vi.fn()
    renderWithProviders(<TestForm onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits validated values through AppField components', async () => {
    const onSubmit = vi.fn()
    renderWithProviders(<TestForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Acme' },
    })
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Hello' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Acme', notes: 'Hello' })
    })
  })
})
