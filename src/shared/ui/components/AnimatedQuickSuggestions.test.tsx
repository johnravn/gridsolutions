import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Theme } from '@radix-ui/themes'
import { AnimatedQuickSuggestions } from './AnimatedQuickSuggestions'

function renderSuggestions(
  props: React.ComponentProps<typeof AnimatedQuickSuggestions>,
) {
  return render(
    <Theme>
      <AnimatedQuickSuggestions {...props} />
    </Theme>,
  )
}

describe('AnimatedQuickSuggestions', () => {
  it('renders static suggestions when animate is false and staticOpen is true', () => {
    renderSuggestions({
      suggestions: ['FOH', 'Monitors'],
      open: false,
      staticOpen: true,
      animate: false,
      onSelect: vi.fn(),
    })

    expect(screen.getByRole('button', { name: 'FOH' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Monitors' })).toBeInTheDocument()
  })

  it('hides suggestions when animate is false and staticOpen is false', () => {
    renderSuggestions({
      suggestions: ['FOH'],
      open: false,
      staticOpen: false,
      animate: false,
      onSelect: vi.fn(),
    })

    expect(
      screen.queryByRole('button', { name: 'FOH' }),
    ).not.toBeInTheDocument()
  })

  it('calls onSelect and onAfterSelect when a chip is clicked', () => {
    const onSelect = vi.fn()
    const onAfterSelect = vi.fn()

    renderSuggestions({
      suggestions: ['Audio'],
      open: true,
      staticOpen: false,
      animate: true,
      onSelect,
      onAfterSelect,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Audio' }))
    expect(onSelect).toHaveBeenCalledWith('Audio')
    expect(onAfterSelect).toHaveBeenCalled()
  })
})
