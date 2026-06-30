import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { CrewSection } from './CrewSection'

describe('CrewSection', () => {
  it('renders crew heading and add crew item button', () => {
    renderWithProviders(
      <CrewSection items={[]} onItemsChange={vi.fn()} companyId="company-1" />,
    )

    expect(screen.getByRole('heading', { name: 'Crew' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Add Crew Item/i }),
    ).toBeInTheDocument()
  })

  it('adds a crew item when Add Crew Item is clicked', () => {
    const onItemsChange = vi.fn()

    renderWithProviders(
      <CrewSection
        items={[]}
        onItemsChange={onItemsChange}
        companyId="company-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Add Crew Item/i }))
    expect(onItemsChange).toHaveBeenCalled()
    expect(onItemsChange.mock.calls[0][0]).toHaveLength(1)
  })
})
