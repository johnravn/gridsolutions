import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { AppToastProvider } from '@shared/ui/toast/ToastProvider'
import EditRoleDialog from './EditRoleDialog'

const { from } = vi.hoisted(() => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ update }))
  return { from }
})

vi.mock('@shared/api/supabase', () => ({
  supabase: { from },
}))

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
}))

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

const initial = {
  id: 'role-1',
  title: '',
  start_at: '2026-08-30T08:00:00',
  end_at: '2026-08-30T18:00:00',
  needed_count: 1,
  role_category: null as string | null,
}

function renderDialog() {
  return renderWithProviders(
    <AppToastProvider>
      <EditRoleDialog
        open
        onOpenChange={vi.fn()}
        jobId="job-1"
        initial={initial}
      />
    </AppToastProvider>,
  )
}

describe('EditRoleDialog', () => {
  beforeEach(() => {
    from.mockClear()
  })

  it('shows the same title and category suggestions as Add role', () => {
    renderDialog()

    expect(
      screen.getByRole('button', { name: 'Technician' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Loader' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Audio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lights' })).toBeInTheDocument()
  })

  it('fills the title from a suggestion without saving the role', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Technician' }))

    expect(
      screen.getByPlaceholderText('e.g. FOH, Monitor, Loader'),
    ).toHaveValue('Technician')
    expect(from).not.toHaveBeenCalled()
  })

  it('fills the category from a suggestion without saving the role', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Audio' }))

    expect(screen.getByPlaceholderText('e.g. Audio, Lights, AV')).toHaveValue(
      'Audio',
    )
    expect(from).not.toHaveBeenCalled()
  })
})
