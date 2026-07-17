import * as React from 'react'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useSplitResize } from './useSplitResize'

export type SplitSlots = {
  contentKey: string
  defaultLeftWidth: number
  minWidthPercent: number
  maxWidthPercent: number
  leftMinWidthPx: number
  rightMinWidthPx: number
  showLeftHeader: boolean
  leftTitle: React.ReactNode | null
  leftToolbar: React.ReactNode | null
  leftBody: React.ReactNode
  leftBodyStyle?: React.CSSProperties
  showRightHeader: boolean
  rightTitle: React.ReactNode | null
  rightToolbar: React.ReactNode | null
  rightBody: React.ReactNode
  rightBodyStyle?: React.CSSProperties
}

type SplitLayoutApi = {
  isLarge: boolean
  /** True once any page has registered into this layout instance (warm chrome). */
  hasSlots: boolean
  register: (slots: SplitSlots) => void
  unregister: () => void
}

type SplitLayoutChromeState = {
  prefersReducedMotion: boolean
  slots: SplitSlots | null
  leftPanelWidth: number
  isMinimized: boolean
  isResizing: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  toggleMinimize: () => void
  expand: () => void
  beginResize: () => void
}

const SplitLayoutApiContext = React.createContext<SplitLayoutApi | null>(null)
const SplitLayoutChromeContext =
  React.createContext<SplitLayoutChromeState | null>(null)

export function SplitLayoutProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const isLarge = useMediaQuery('(min-width: 1024px)')
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [slots, setSlots] = React.useState<SplitSlots | null>(null)
  const [hasSlots, setHasSlots] = React.useState(false)
  const lastContentKeyRef = React.useRef<string | null>(null)

  const resize = useSplitResize({
    minWidthPercent: 15,
    maxWidthPercent: 75,
  })

  const clearDragForPageRef = React.useRef(resize.clearDragForPage)
  const setClampsRef = React.useRef(resize.setClamps)
  clearDragForPageRef.current = resize.clearDragForPage
  setClampsRef.current = resize.setClamps

  const register = React.useCallback((next: SplitSlots) => {
    setClampsRef.current(next.minWidthPercent, next.maxWidthPercent)

    const keyChanged = lastContentKeyRef.current !== next.contentKey
    if (keyChanged) {
      lastContentKeyRef.current = next.contentKey
      // Drop any drag from the previous page and lock this page's absolute
      // default. Chrome renders `dragWidth ?? slots.defaultLeftWidth`, so the
      // split always lands on this page's predetermined % regardless of
      // whether we came from Latest (37) or Vehicles (50).
      clearDragForPageRef.current(next.defaultLeftWidth)
    }

    setSlots(next)
    setHasSlots(true)
  }, [])

  const unregister = React.useCallback(() => {
    setSlots(null)
    setHasSlots(false)
    lastContentKeyRef.current = null
  }, [])

  const leftPanelWidth = slots
    ? resize.resolveWidth(slots.defaultLeftWidth)
    : 50

  // Stable for SplitPage — must NOT change when slot *content* updates.
  const api = React.useMemo<SplitLayoutApi>(
    () => ({
      isLarge,
      hasSlots,
      register,
      unregister,
    }),
    [isLarge, hasSlots, register, unregister],
  )

  const chrome = React.useMemo<SplitLayoutChromeState>(
    () => ({
      prefersReducedMotion,
      slots,
      leftPanelWidth,
      isMinimized: resize.isMinimized,
      isResizing: resize.isResizing,
      containerRef: resize.containerRef,
      toggleMinimize: resize.toggleMinimize,
      expand: resize.expand,
      beginResize: resize.beginResize,
    }),
    [
      prefersReducedMotion,
      slots,
      leftPanelWidth,
      resize.isMinimized,
      resize.isResizing,
      resize.containerRef,
      resize.toggleMinimize,
      resize.expand,
      resize.beginResize,
    ],
  )

  return (
    <SplitLayoutApiContext.Provider value={api}>
      <SplitLayoutChromeContext.Provider value={chrome}>
        {children}
      </SplitLayoutChromeContext.Provider>
    </SplitLayoutApiContext.Provider>
  )
}

/** Registration + breakpoint API for page components. */
export function useSplitLayout() {
  const ctx = React.useContext(SplitLayoutApiContext)
  if (!ctx) {
    throw new Error('useSplitLayout must be used within SplitLayoutProvider')
  }
  return ctx
}

/** Chrome state for the persistent shell only. */
export function useSplitLayoutChrome() {
  const ctx = React.useContext(SplitLayoutChromeContext)
  if (!ctx) {
    throw new Error(
      'useSplitLayoutChrome must be used within SplitLayoutProvider',
    )
  }
  return ctx
}

export function useClearSplitSlotsOnMount() {
  const { unregister } = useSplitLayout()
  React.useLayoutEffect(() => {
    unregister()
  }, [unregister])
}

/** Render alongside early returns (skeletons) so prior page slots do not linger. */
export function SplitSlotsClear() {
  useClearSplitSlotsOnMount()
  return null
}
