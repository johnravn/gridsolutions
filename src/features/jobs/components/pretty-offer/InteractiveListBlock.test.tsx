import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InteractiveListBlock } from './InteractiveListBlock'

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
}))

describe('InteractiveListBlock', () => {
  const items = [
    {
      id: 'item-1',
      block_id: 'block-1',
      sort_order: 0,
      label: 'First item',
      summary: null,
      detail: 'Expanded detail text',
    },
    {
      id: 'item-2',
      block_id: 'block-1',
      sort_order: 1,
      label: 'Second item',
      summary: null,
      detail: null,
    },
  ]

  it('toggles detail on click when hover is unavailable', () => {
    render(<InteractiveListBlock items={items} />)

    expect(screen.getByText('Expanded detail text')).not.toBeVisible()

    fireEvent.click(screen.getByText('First item'))
    expect(screen.getByText('Expanded detail text')).toBeVisible()

    fireEvent.click(screen.getByText('First item'))
    expect(screen.getByText('Expanded detail text')).not.toBeVisible()
  })

  it('renders items in sort_order', () => {
    render(<InteractiveListBlock items={[...items].reverse()} />)
    const labels = screen.getAllByText(/item$/)
    expect(labels[0]).toHaveTextContent('First item')
    expect(labels[1]).toHaveTextContent('Second item')
  })
})
