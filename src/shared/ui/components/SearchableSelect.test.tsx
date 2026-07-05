import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { SearchableSelect } from './SearchableSelect'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
]

const mockRect = {
  width: 320,
  height: 32,
  top: 100,
  left: 50,
  bottom: 132,
  right: 370,
  x: 50,
  y: 100,
  toJSON: () => ({}),
}

describe('SearchableSelect', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      mockRect as DOMRect,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders with placeholder and selected label', () => {
    renderWithProviders(
      <SearchableSelect
        options={options}
        value="a"
        onValueChange={vi.fn()}
        placeholder="Pick one"
      />,
    )

    expect(screen.getByRole('textbox')).toHaveValue('Alpha')
  })

  it('calls onValueChange when option is selected', async () => {
    const onValueChange = vi.fn()

    renderWithProviders(
      <SearchableSelect
        options={options}
        value=""
        onValueChange={onValueChange}
        placeholder="Pick one"
        data-testid="search-select"
      />,
    )

    fireEvent.focus(screen.getByTestId('search-select'))
    const option = await screen.findByText('Bravo')
    fireEvent.pointerDown(option)
    expect(onValueChange).toHaveBeenCalledWith('b')
  })

  it('shows empty message when no options match', async () => {
    renderWithProviders(
      <SearchableSelect
        options={options}
        value=""
        onValueChange={vi.fn()}
        placeholder="Pick one"
        emptyMessage="Nothing found"
        data-testid="search-select"
      />,
    )

    const input = screen.getByTestId('search-select')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zzzzz' } })
    expect(await screen.findByText('Nothing found')).toBeInTheDocument()
  })

  it('allows typing to filter when a placeholder option is selected', async () => {
    renderWithProviders(
      <SearchableSelect
        options={[{ value: '__none__', label: 'No contact' }, ...options]}
        value="__none__"
        onValueChange={vi.fn()}
        placeholder="Search contact…"
        data-testid="search-select"
      />,
    )

    const input = screen.getByTestId('search-select')
    expect(input).toHaveValue('No contact')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Al' } })
    expect(input).toHaveValue('Al')
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  it('highlights options with arrow keys and selects with Enter', async () => {
    const onValueChange = vi.fn()

    renderWithProviders(
      <SearchableSelect
        options={options}
        value=""
        onValueChange={onValueChange}
        placeholder="Pick one"
        data-testid="search-select"
      />,
    )

    const input = screen.getByTestId('search-select')
    fireEvent.focus(input)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(
      document.querySelector('[data-searchable-select-option-index="0"]'),
    ).toHaveStyle({ backgroundColor: 'var(--gray-a3)' })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const bravoOption = document.querySelector(
      '[data-searchable-select-option-index="1"]',
    )
    expect(bravoOption).toHaveStyle({ backgroundColor: 'var(--gray-a3)' })

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onValueChange).toHaveBeenCalledWith('b')
  })
})
