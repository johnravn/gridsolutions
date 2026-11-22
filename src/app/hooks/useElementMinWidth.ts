import * as React from 'react'

/**
 * True when `ref`'s element is at least `minWidthPx` wide.
 * Observes the element itself (ResizeObserver), not the viewport —
 * so sidebar/chrome state does not force the result.
 */
export function useElementMinWidth(
  ref: React.RefObject<HTMLElement | null>,
  minWidthPx: number,
): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      setMatches(el.clientWidth >= minWidthPx)
    }

    update()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }

    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, minWidthPx])

  return matches
}
