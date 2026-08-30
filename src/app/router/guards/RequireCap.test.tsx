import { Theme } from '@radix-ui/themes'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RequireCap from './RequireCap'
import type { Capability } from '@shared/auth/permissions'

const { navigateMock, useAuthzMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useAuthzMock: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@shared/auth/useAuthz', () => ({
  useAuthz: () => useAuthzMock(),
}))

function renderGuard(need: Capability = 'visit:logging') {
  return render(
    <Theme>
      <RequireCap need={need}>
        <div>page content</div>
      </RequireCap>
    </Theme>,
  )
}

describe('RequireCap', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    useAuthzMock.mockReset()
  })

  it('does not redirect while capabilities are still loading', () => {
    useAuthzMock.mockReturnValue({
      loading: true,
      caps: new Set<Capability>(),
    })

    renderGuard()

    expect(screen.getByText('Thinking')).toBeTruthy()
    expect(screen.queryByText('page content')).toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('renders children when the user has the required capability', () => {
    useAuthzMock.mockReturnValue({
      loading: false,
      caps: new Set<Capability>(['visit:logging']),
    })

    renderGuard()

    expect(screen.getByText('page content')).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('redirects to home only after loading finishes without the capability', async () => {
    useAuthzMock.mockReturnValue({
      loading: false,
      caps: new Set<Capability>(['visit:home']),
    })

    renderGuard()

    expect(screen.queryByText('page content')).toBeNull()
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/dashboard',
        replace: true,
      })
    })
  })
})
