import * as React from 'react'

export type SplitResizeOptions = {
  initialWidth?: number
  minWidthPercent?: number
  maxWidthPercent?: number
}

/**
 * In-memory resize state for the persistent split shell.
 *
 * Display width is `dragWidth ?? pageDefault`. User drags set `dragWidth`;
 * page navigations call `clearDragForPage(default)`, which drops the override
 * so the chrome always uses that page's absolute default — never a leftover
 * width from Latest/Vehicles/etc.
 */
export function useSplitResize({
  minWidthPercent = 15,
  maxWidthPercent = 75,
}: SplitResizeOptions = {}) {
  /** null = use the active page's defaultLeftWidth */
  const [dragWidth, setDragWidth] = React.useState<number | null>(null)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const clampsRef = React.useRef({ minWidthPercent, maxWidthPercent })
  const isMinimizedRef = React.useRef(isMinimized)

  React.useEffect(() => {
    clampsRef.current = { minWidthPercent, maxWidthPercent }
  }, [minWidthPercent, maxWidthPercent])

  React.useEffect(() => {
    isMinimizedRef.current = isMinimized
  }, [isMinimized])

  const toggleMinimize = React.useCallback(() => {
    setIsMinimized((prev) => !prev)
  }, [])

  const expand = React.useCallback(() => {
    setIsMinimized(false)
  }, [])

  const beginResize = React.useCallback(() => {
    setIsResizing(true)
  }, [])

  /**
   * Drop any drag override so chrome falls back to the page's absolute default.
   * Call on every contentKey change. `pageDefault` is accepted for API clarity
   * (the chrome reads the live default from slots).
   */
  const clearDragForPage = React.useCallback((_pageDefault: number) => {
    setDragWidth(null)
  }, [])

  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      if (containerWidth <= 0) return

      const mouseX = e.clientX - containerRect.left
      const { minWidthPercent: minW, maxWidthPercent: maxW } = clampsRef.current
      const newWidthPercent = Math.max(
        minW,
        Math.min(maxW, (mouseX / containerWidth) * 100),
      )
      setDragWidth(newWidthPercent)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  return {
    containerRef,
    dragWidth,
    isMinimized,
    isResizing,
    toggleMinimize,
    expand,
    beginResize,
    clearDragForPage,
    setClamps: (min: number, max: number) => {
      clampsRef.current = { minWidthPercent: min, maxWidthPercent: max }
    },
    /** Width to paint for the active page. */
    resolveWidth: (pageDefault: number) => dragWidth ?? pageDefault,
  }
}
