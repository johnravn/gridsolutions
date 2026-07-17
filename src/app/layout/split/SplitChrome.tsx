import * as React from 'react'
import {
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  IconButton,
  Separator,
  Tooltip,
} from '@radix-ui/themes'
import { AnimatePresence, motion } from 'framer-motion'
import { TransitionLeft } from 'iconoir-react'
import {
  formatShortcut,
  useModKeyShortcut,
} from '@shared/lib/keyboardShortcuts'
import { useResolvedShortcuts } from '@shared/hotkeys'
import { useSplitLayout, useSplitLayoutChrome } from './SplitLayoutContext'
import type { SplitSlots } from './SplitLayoutContext'
import './splitLayout.css'

function GlowingMinimizeBar({ onExpand }: { onExpand: () => void }) {
  return (
    <Box
      onClick={onExpand}
      onMouseEnter={(e) => {
        const bar = e.currentTarget.querySelector('[data-glowing-bar]')
        if (bar instanceof HTMLElement) bar.style.width = '24px'
      }}
      onMouseLeave={(e) => {
        const bar = e.currentTarget.querySelector('[data-glowing-bar]')
        if (bar instanceof HTMLElement) bar.style.width = '12px'
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        cursor: 'pointer',
        zIndex: 1,
      }}
    >
      <Box
        data-glowing-bar
        className="split-glow-bar"
        style={{
          position: 'absolute',
          left: '50%',
          top: '20px',
          bottom: '20px',
          transform: 'translateX(-50%)',
          width: '12px',
          borderRadius: '4px',
          background:
            'linear-gradient(180deg, var(--accent-9), var(--accent-6))',
          pointerEvents: 'none',
          zIndex: 5,
          transition: 'all 0.2s ease-out',
        }}
      />
    </Box>
  )
}

function CollapseButton({
  onClick,
  label,
  overlay,
}: {
  onClick: () => void
  label: string
  overlay?: boolean
}) {
  const button = (
    <Tooltip content={`Collapse sidebar (${label})`}>
      <IconButton
        size="3"
        variant="ghost"
        onClick={onClick}
        style={{ flexShrink: 0 }}
      >
        <TransitionLeft width={22} height={22} />
      </IconButton>
    </Tooltip>
  )

  if (!overlay) return button

  return (
    <Box style={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}>
      {button}
    </Box>
  )
}

function TitleNode({
  title,
  mb,
}: {
  title: React.ReactNode
  mb?: '3' | undefined
}) {
  if (typeof title === 'string' || typeof title === 'number') {
    return (
      <Heading size="5" mb={mb}>
        {title}
      </Heading>
    )
  }
  return <>{title}</>
}

function ContentFade({
  contentKey,
  reducedMotion,
  children,
}: {
  contentKey: string
  reducedMotion: boolean
  children: React.ReactNode
}) {
  if (reducedMotion) {
    return <>{children}</>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={contentKey}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

function LeftHeader({
  slots,
  collapseLabel,
  onCollapse,
}: {
  slots: SplitSlots
  collapseLabel: string
  onCollapse: () => void
}) {
  if (!slots.showLeftHeader) {
    return (
      <CollapseButton
        onClick={onCollapse}
        label={collapseLabel}
        overlay
      />
    )
  }

  return (
    <>
      <Flex align="center" justify="between" mb="3" wrap="wrap" gap="2">
        <TitleNode title={slots.leftTitle ?? ''} />
        <Flex align="center" gap="2" wrap="wrap">
          {slots.leftToolbar}
          <CollapseButton onClick={onCollapse} label={collapseLabel} />
        </Flex>
      </Flex>
      <Separator size="4" mb="3" />
    </>
  )
}

function RightHeader({ slots }: { slots: SplitSlots }) {
  if (!slots.showRightHeader) return null

  if (slots.rightToolbar) {
    return (
      <>
        <Flex align="center" justify="between" mb="3" wrap="wrap" gap="2">
          <TitleNode title={slots.rightTitle ?? 'Inspector'} />
          {slots.rightToolbar}
        </Flex>
        <Separator size="4" mb="3" />
      </>
    )
  }

  return (
    <>
      <TitleNode title={slots.rightTitle ?? 'Inspector'} mb="3" />
      <Separator size="4" mb="3" />
    </>
  )
}

export function SplitChrome() {
  const {
    prefersReducedMotion,
    slots,
    leftPanelWidth,
    isMinimized,
    isResizing,
    containerRef,
    toggleMinimize,
    expand,
    beginResize,
  } = useSplitLayoutChrome()
  const { isLarge } = useSplitLayout()

  const resolved = useResolvedShortcuts()
  const collapseShortcutLabel = formatShortcut(
    resolved['panel.collapse'] ?? 'Mod+B',
  )

  useModKeyShortcut({
    key: 'b',
    enabled: isLarge && !!slots,
    onTrigger: toggleMinimize,
  })

  if (!isLarge || !slots) return null

  const widthTransition =
    isResizing || prefersReducedMotion
      ? 'none'
      : 'width 0.22s ease-out, flex-basis 0.22s ease-out'

  // Absolute page default (or in-page drag). Never a relative offset from the
  // previous route — leftPanelWidth is resolveWidth(slots.defaultLeftWidth).
  const leftWidth = isMinimized ? '60px' : `${leftPanelWidth}%`

  return (
    <section style={{ height: '100%', minHeight: 0 }}>
      <Flex
        ref={containerRef}
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
          position: 'relative',
        }}
      >
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            // Drive size with an absolute width/% only. Do not use flex-grow
            // shorthand that fights `width` — that skipped the CSS transition
            // and made the split look like it jumped from a relative offset.
            width: leftWidth,
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: leftWidth,
            height: '100%',
            minWidth: isMinimized ? '60px' : 0,
            maxWidth: isMinimized ? '60px' : '75%',
            minHeight: 0,
            transition: widthTransition,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isMinimized ? (
            <GlowingMinimizeBar onExpand={expand} />
          ) : (
            <ContentFade
              contentKey={slots.contentKey}
              reducedMotion={prefersReducedMotion}
            >
              <LeftHeader
                slots={slots}
                collapseLabel={collapseShortcutLabel}
                onCollapse={toggleMinimize}
              />
              <Box
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  ...slots.leftBodyStyle,
                }}
              >
                {slots.leftBody}
              </Box>
            </ContentFade>
          )}
        </Card>

        {!isMinimized && (
          <Box
            className="section-resizer"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              beginResize()
            }}
            style={{
              width: '6px',
              height: '20%',
              cursor: 'col-resize',
              backgroundColor: 'var(--gray-a4)',
              borderRadius: '4px',
              flexShrink: 0,
              alignSelf: 'center',
              userSelect: 'none',
              margin: '0 -4px',
              zIndex: 10,
              transition: isResizing ? 'none' : 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
              }
            }}
          />
        )}

        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <ContentFade
            contentKey={slots.contentKey}
            reducedMotion={prefersReducedMotion}
          >
            <RightHeader slots={slots} />
            <Box
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                ...slots.rightBodyStyle,
              }}
            >
              {slots.rightBody}
            </Box>
          </ContentFade>
        </Card>
      </Flex>
    </section>
  )
}

/** Mobile stacked cards — used by SplitPage when viewport is small. */
export function SplitMobileStack({
  leftTitle,
  leftToolbar,
  left,
  rightTitle = 'Inspector',
  rightToolbar,
  right,
  showLeftHeader = true,
  showRightHeader = true,
  leftBodyStyle,
  rightBodyStyle,
  leftCardStyle,
  rightCardStyle,
  sectionRef,
  rightWrapper,
  footer,
}: {
  leftTitle?: React.ReactNode
  leftToolbar?: React.ReactNode
  left: React.ReactNode
  rightTitle?: React.ReactNode
  rightToolbar?: React.ReactNode
  right: React.ReactNode
  showLeftHeader?: boolean
  showRightHeader?: boolean
  leftBodyStyle?: React.CSSProperties
  rightBodyStyle?: React.CSSProperties
  leftCardStyle?: React.CSSProperties
  rightCardStyle?: React.CSSProperties
  sectionRef?: React.Ref<HTMLElement>
  rightWrapper?: (card: React.ReactNode) => React.ReactNode
  footer?: React.ReactNode
}) {
  const leftCard = (
    <Card
      size="3"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...leftCardStyle,
      }}
    >
      {showLeftHeader && (
        <>
          <Flex align="center" justify="between" mb="3" wrap="wrap" gap="3">
            <TitleNode title={leftTitle ?? ''} />
            {leftToolbar}
          </Flex>
          <Separator size="4" mb="3" />
        </>
      )}
      <Box style={{ minHeight: 0, ...leftBodyStyle }}>{left}</Box>
    </Card>
  )

  const rightCard = (
    <Card
      size="3"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...rightCardStyle,
      }}
    >
      {showRightHeader && (
        <>
          {rightToolbar ? (
            <Flex align="center" justify="between" mb="3" wrap="wrap" gap="2">
              <TitleNode title={rightTitle} />
              {rightToolbar}
            </Flex>
          ) : (
            <TitleNode title={rightTitle} mb="3" />
          )}
          <Separator size="4" mb="3" />
        </>
      )}
      <Box style={{ minHeight: 0, overflowY: 'auto', ...rightBodyStyle }}>
        {right}
      </Box>
    </Card>
  )

  return (
    <section ref={sectionRef} style={{ minHeight: 0 }}>
      <Grid columns="1fr" gap="4" align="stretch" style={{ minHeight: 0 }}>
        {leftCard}
        {rightWrapper ? rightWrapper(rightCard) : rightCard}
      </Grid>
      {footer}
    </section>
  )
}
