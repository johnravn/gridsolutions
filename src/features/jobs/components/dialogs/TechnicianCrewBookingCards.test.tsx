import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { TechnicianCrewBookingCards } from './TechnicianCrewBookingCards'
import type { TechnicianCrewBookingSelection } from '../../utils/technicianCrewBooking'

function Harness({
  initial = null,
}: {
  initial?: TechnicianCrewBookingSelection
}) {
  const [value, setValue] = useState<TechnicianCrewBookingSelection>(initial)
  return <TechnicianCrewBookingCards value={value} onChange={setValue} />
}

function openCard() {
  return screen.getByRole('checkbox', { name: /Leave it open/i })
}

function confirmCard() {
  return screen.getByRole('checkbox', { name: /Confirm myself/i })
}

describe('TechnicianCrewBookingCards', () => {
  it('starts with neither card selected', () => {
    renderWithProviders(<Harness />)

    expect(openCard()).toHaveAttribute('aria-checked', 'false')
    expect(confirmCard()).toHaveAttribute('aria-checked', 'false')
  })

  it('selects a card, then deselects it on a second click', () => {
    renderWithProviders(<Harness />)

    fireEvent.click(openCard())
    expect(openCard()).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(openCard())
    expect(openCard()).toHaveAttribute('aria-checked', 'false')
    expect(confirmCard()).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps only one card selected at a time', () => {
    renderWithProviders(<Harness />)

    fireEvent.click(openCard())
    fireEvent.click(confirmCard())

    expect(openCard()).toHaveAttribute('aria-checked', 'false')
    expect(confirmCard()).toHaveAttribute('aria-checked', 'true')
  })

  it('notifies the parent with null when the selected card is clicked again', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TechnicianCrewBookingCards value="open" onChange={onChange} />,
    )

    fireEvent.click(openCard())
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
