import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { ContaLinkedBadge } from './ContaLinkedBadge'

describe('ContaLinkedBadge', () => {
  it('shows Linked when the customer is synced', () => {
    renderWithProviders(<ContaLinkedBadge linked />)
    expect(screen.getByText('Linked')).toBeInTheDocument()
  })

  it('shows Not linked when the customer is not synced', () => {
    renderWithProviders(<ContaLinkedBadge linked={false} />)
    expect(screen.getByText('Not linked')).toBeInTheDocument()
  })
})
