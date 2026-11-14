import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Theme } from '@radix-ui/themes'
import { MobileDetailBackFab } from './MobileDetailBackFab'

describe('MobileDetailBackFab', () => {
  it('calls onBack when pressed', () => {
    const onBack = vi.fn()

    render(
      <Theme>
        <MobileDetailBackFab onBack={onBack} />
      </Theme>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
