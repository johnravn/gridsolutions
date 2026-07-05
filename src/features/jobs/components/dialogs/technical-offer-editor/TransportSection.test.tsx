import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { TransportSection } from './TransportSection'

describe('TransportSection', () => {
  it('renders transport heading and add group button', () => {
    renderWithProviders(
      <TransportSection
        groups={[]}
        onGroupsChange={vi.fn()}
        companyId="company-1"
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Transport' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Add group/i }),
    ).toBeInTheDocument()
  })

  it('adds a transport group when Add group is clicked', () => {
    const onGroupsChange = vi.fn()

    renderWithProviders(
      <TransportSection
        groups={[]}
        onGroupsChange={onGroupsChange}
        companyId="company-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Add group/i }))
    expect(onGroupsChange).toHaveBeenCalled()
    expect(onGroupsChange.mock.calls[0][0]).toHaveLength(1)
  })
})
