import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import LazyImage from './LazyImage'

const FULL_SRC =
  'https://abc.supabase.co/storage/v1/object/public/gallery/photo.jpg'
const PLACEHOLDER_SRC =
  'https://abc.supabase.co/storage/v1/render/image/public/gallery/photo.jpg?width=40&quality=20&resize=cover'

describe('LazyImage', () => {
  let observerCallback: IntersectionObserverCallback | null = null

  beforeEach(() => {
    observerCallback = null

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function IntersectionObserverMock(
        this: IntersectionObserver,
        callback: IntersectionObserverCallback,
      ) {
        observerCallback = callback
        this.observe = vi.fn()
        this.unobserve = vi.fn()
        this.disconnect = vi.fn()
        return this
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads images once visible in the viewport', async () => {
    render(
      <LazyImage
        src={FULL_SRC}
        alt="Gallery photo"
        data-testid="lazy-image"
        style={{ width: 200, height: 120 }}
      />,
    )

    expect(screen.queryByAltText('Gallery photo')).not.toBeInTheDocument()

    observerCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )

    await waitFor(() => {
      expect(screen.getByAltText('Gallery photo')).toBeInTheDocument()
    })

    expect(screen.getByAltText('Gallery photo')).toHaveAttribute(
      'src',
      FULL_SRC,
    )
    expect(document.querySelector('.lazy-image__placeholder')).toHaveAttribute(
      'src',
      PLACEHOLDER_SRC,
    )
  })

  it('loads immediately when eager', () => {
    render(<LazyImage src={FULL_SRC} alt="Hero" eager />)
    expect(screen.getByAltText('Hero')).toBeInTheDocument()
  })

  it('falls back to blurred full image when the tiny placeholder fails', async () => {
    render(<LazyImage src={FULL_SRC} alt="Gallery photo" eager />)

    const placeholder = document.querySelector(
      '.lazy-image__placeholder',
    ) as HTMLImageElement
    expect(placeholder).toBeInTheDocument()

    fireEvent.error(placeholder)

    await waitFor(() => {
      expect(
        document.querySelector('.lazy-image__full--blur-loading'),
      ).toBeInTheDocument()
    })
    expect(
      document.querySelector('.lazy-image__placeholder'),
    ).not.toBeInTheDocument()
  })
})
