import * as React from 'react'
import { useMediaQuery } from '@app/hooks/useMediaQuery'

const LARGE_BREAKPOINT = '(min-width: 1024px)'

export function useHomeResizeLayout() {
  const isLarge = useMediaQuery(LARGE_BREAKPOINT)

  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(50)
  const [isResizing, setIsResizing] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const rafIdRef = React.useRef<number | null>(null)
  const pendingWidthRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const mouseX = e.clientX - containerRect.left

      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )

      pendingWidthRef.current = newWidthPercent

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (pendingWidthRef.current !== null) {
            setLeftPanelWidth((prev) => {
              if (Math.abs(prev - pendingWidthRef.current!) < 0.1) return prev
              return pendingWidthRef.current!
            })
            pendingWidthRef.current = null
          }
          rafIdRef.current = null
        })
      }
    }

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (pendingWidthRef.current !== null) {
        setLeftPanelWidth((prev) => {
          if (Math.abs(prev - pendingWidthRef.current!) < 0.1) return prev
          return pendingWidthRef.current!
        })
        pendingWidthRef.current = null
      }
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      pendingWidthRef.current = null
    }
  }, [isResizing])

  return {
    isLarge,
    containerRef,
    leftPanelWidth,
    isResizing,
    setIsResizing,
  }
}
