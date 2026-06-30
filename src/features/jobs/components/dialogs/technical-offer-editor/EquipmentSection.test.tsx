import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { EquipmentSection } from './EquipmentSection'

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('EquipmentSection', () => {
  it('renders equipment heading and add group button', () => {
    renderWithProviders(
      <EquipmentSection
        groups={[]}
        onGroupsChange={vi.fn()}
        expandedGroups={new Set()}
        onExpandedGroupsChange={vi.fn()}
        companyId="company-1"
        equipmentDaysOfUse={3}
        equipmentRentalFactor={1.5}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Equipment' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add Group' }),
    ).toBeInTheDocument()
  })

  it('adds a group when Add Group is clicked', () => {
    const onGroupsChange = vi.fn()

    renderWithProviders(
      <EquipmentSection
        groups={[]}
        onGroupsChange={onGroupsChange}
        expandedGroups={new Set()}
        onExpandedGroupsChange={vi.fn()}
        companyId="company-1"
        equipmentDaysOfUse={3}
        equipmentRentalFactor={1.5}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Group' }))
    expect(onGroupsChange).toHaveBeenCalled()
    expect(onGroupsChange.mock.calls[0][0]).toHaveLength(1)
  })
})
