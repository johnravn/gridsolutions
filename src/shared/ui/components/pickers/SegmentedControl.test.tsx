import { describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { SegmentedControl } from './SegmentedControl'

describe('SegmentedControl', () => {
  it('renders segments and calls onChange when clicked', () => {
    const onChange = vi.fn()
    const { getByRole } = renderWithProviders(
      <SegmentedControl
        segments={[
          { id: 'day', label: 'Day' },
          { id: 'week', label: 'Week' },
        ]}
        activeId="day"
        onChange={onChange}
      />,
    )

    expect(getByRole('button', { name: 'Day' })).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Week' }))
    expect(onChange).toHaveBeenCalledWith('week')
  })
})
