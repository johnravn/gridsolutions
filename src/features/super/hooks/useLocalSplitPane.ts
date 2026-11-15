import * as React from 'react'

export type LocalSplitPaneOptions = {
  defaultWidthPercent?: number
  minWidthPercent?: number
  maxWidthPercent?: number
}

/**
 * Local master/detail resize + minimize for Super tabs that sit outside
 * the app-wide SplitLayoutProvider chrome.
 */
export function useLocalSplitPane({
  defaultWidthPercent = 40,
  minWidthPercent = 25,
  maxWidthPercent = 75,
}: LocalSplitPaneOptions = {}) {
  const [leftWidth, setLeftWidth] = React.useState(defaultWidthPercent)
  const [savedWidth, setSavedWidth] = React.useState(defaultWidthPercent)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const clampsRef = React.useRef({ minWidthPercent, maxWidthPercent })

  React.useEffect(() => {
    clampsRef.current = { minWidthPercent, maxWidthPercent }
  }, [minWidthPercent, maxWidthPercent])

  const toggleMinimize = React.useCallback(() => {
    if (isMinimized) {
      setLeftWidth(savedWidth || defaultWidthPercent)
      setIsMinimized(false)
    } else {
      setSavedWidth(leftWidth)
      setIsMinimized(true)
    }
  }, [defaultWidthPercent, isMinimized, leftWidth, savedWidth])

  const expandFromBar = React.useCallback(() => {
    if (!isMinimized) return
    setLeftWidth(savedWidth || defaultWidthPercent)
    setIsMinimized(false)
  }, [defaultWidthPercent, isMinimized, savedWidth])

  const beginResize = React.useCallback(() => {
    setIsResizing(true)
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
      setLeftWidth(
        Math.max(minW, Math.min(maxW, (mouseX / containerWidth) * 100)),
      )
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
    leftWidth,
    isMinimized,
    isResizing,
    toggleMinimize,
    expandFromBar,
    beginResize,
  }
}
