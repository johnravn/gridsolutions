import * as React from 'react'
import { useRouterState } from '@tanstack/react-router'
import { SplitMobileStack } from './SplitChrome'
import { useSplitLayout } from './SplitLayoutContext'
import type { SplitSlots } from './SplitLayoutContext'

export type SplitPageProps = {
  defaultLeftWidth: number
  /** Override animation/remount key; defaults to current pathname. */
  contentKey?: string
  minWidthPercent?: number
  maxWidthPercent?: number
  leftMinWidthPx?: number
  rightMinWidthPx?: number

  title?: React.ReactNode
  leftToolbar?: React.ReactNode
  left: React.ReactNode
  leftBodyStyle?: React.CSSProperties
  /** When false, left has no title row; collapse control is overlaid. */
  showLeftHeader?: boolean

  rightTitle?: React.ReactNode
  rightToolbar?: React.ReactNode
  right: React.ReactNode
  rightBodyStyle?: React.CSSProperties
  showRightHeader?: boolean

  /** Mobile-only extras */
  mobileLeftCardStyle?: React.CSSProperties
  mobileRightCardStyle?: React.CSSProperties
  mobileLeftBodyStyle?: React.CSSProperties
  mobileRightBodyStyle?: React.CSSProperties
  /** Override left toolbar on mobile; pass `null` to hide. */
  mobileLeftToolbar?: React.ReactNode | null
  mobileSectionRef?: React.Ref<HTMLElement>
  mobileRightWrapper?: (card: React.ReactNode) => React.ReactNode
  mobileFooter?: React.ReactNode
}

export function SplitPage({
  defaultLeftWidth,
  contentKey: contentKeyProp,
  minWidthPercent = 15,
  maxWidthPercent = 75,
  leftMinWidthPx = 300,
  rightMinWidthPx = 300,
  title,
  leftToolbar,
  left,
  leftBodyStyle,
  showLeftHeader = true,
  rightTitle = 'Inspector',
  rightToolbar,
  right,
  rightBodyStyle,
  showRightHeader = true,
  mobileLeftCardStyle,
  mobileRightCardStyle,
  mobileLeftBodyStyle,
  mobileRightBodyStyle,
  mobileLeftToolbar,
  mobileSectionRef,
  mobileRightWrapper,
  mobileFooter,
}: SplitPageProps) {
  const { isLarge, register, unregister } = useSplitLayout()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const contentKey = contentKeyProp ?? pathname

  const slots = React.useMemo<SplitSlots>(
    () => ({
      contentKey,
      defaultLeftWidth,
      minWidthPercent,
      maxWidthPercent,
      leftMinWidthPx,
      rightMinWidthPx,
      showLeftHeader,
      leftTitle: title ?? null,
      leftToolbar: leftToolbar ?? null,
      leftBody: left,
      leftBodyStyle,
      showRightHeader,
      rightTitle: rightTitle ?? null,
      rightToolbar: rightToolbar ?? null,
      rightBody: right,
      rightBodyStyle,
    }),
    [
      contentKey,
      defaultLeftWidth,
      minWidthPercent,
      maxWidthPercent,
      leftMinWidthPx,
      rightMinWidthPx,
      showLeftHeader,
      title,
      leftToolbar,
      left,
      leftBodyStyle,
      showRightHeader,
      rightTitle,
      rightToolbar,
      right,
      rightBodyStyle,
    ],
  )

  // Register into the persistent chrome. Do not unregister on unmount while
  // navigating between split pages — that would briefly hide the shell.
  React.useLayoutEffect(() => {
    if (!isLarge) {
      unregister()
      return
    }
    register(slots)
  }, [isLarge, register, unregister, slots])

  if (isLarge) {
    return null
  }

  return (
    <SplitMobileStack
      leftTitle={title}
      leftToolbar={
        mobileLeftToolbar === undefined ? leftToolbar : mobileLeftToolbar
      }
      left={left}
      rightTitle={rightTitle}
      rightToolbar={rightToolbar}
      right={right}
      showLeftHeader={showLeftHeader}
      showRightHeader={showRightHeader}
      leftBodyStyle={mobileLeftBodyStyle ?? leftBodyStyle}
      rightBodyStyle={mobileRightBodyStyle ?? rightBodyStyle}
      leftCardStyle={mobileLeftCardStyle}
      rightCardStyle={mobileRightCardStyle}
      sectionRef={mobileSectionRef}
      rightWrapper={mobileRightWrapper}
      footer={mobileFooter}
    />
  )
}
