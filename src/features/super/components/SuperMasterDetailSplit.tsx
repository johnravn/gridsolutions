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
import { TransitionLeft } from 'iconoir-react'
import type { useLocalSplitPane } from '../hooks/useLocalSplitPane'

type Pane = ReturnType<typeof useLocalSplitPane>

type Props = {
  isLarge: boolean
  title: string
  collapseShortcutLabel: string
  pane: Pane
  listHeaderActions?: React.ReactNode
  list: React.ReactNode
  inspector: React.ReactNode
}

export function SuperMasterDetailSplit({
  isLarge,
  title,
  collapseShortcutLabel,
  pane,
  listHeaderActions,
  list,
  inspector,
}: Props) {
  const {
    containerRef,
    leftWidth,
    isMinimized,
    isResizing,
    toggleMinimize,
    expandFromBar,
    beginResize,
  } = pane

  const listHeader = (
    <Flex align="center" justify="between" mb="3">
      <Heading size="5">{title}</Heading>
      <Flex align="center" gap="2">
        {listHeaderActions}
        {isLarge && (
          <Tooltip content={`Collapse sidebar (${collapseShortcutLabel})`}>
            <IconButton
              className="split-header-icon-button"
              size="3"
              variant="ghost"
              onClick={toggleMinimize}
            >
              <TransitionLeft width={22} height={22} />
            </IconButton>
          </Tooltip>
        )}
      </Flex>
    </Flex>
  )

  const listBody = (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {list}
    </Box>
  )

  const inspectorCard = (
    <Card
      size="3"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: isLarge ? 1 : undefined,
        height: isLarge ? '100%' : undefined,
        maxHeight: isLarge ? '100%' : undefined,
        overflow: isLarge ? 'hidden' : 'visible',
        minWidth: isLarge ? '300px' : undefined,
        minHeight: 0,
        transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
      }}
    >
      <Heading size="5" mb="3">
        Inspector
      </Heading>
      <Separator size="4" mb="3" />
      <Box
        style={{
          flex: isLarge ? 1 : undefined,
          minHeight: isLarge ? 0 : undefined,
          overflowY: isLarge ? 'auto' : 'visible',
        }}
      >
        {inspector}
      </Box>
    </Card>
  )

  if (!isLarge) {
    return (
      <Grid columns="1fr" gap="4" align="stretch" style={{ minHeight: 0 }}>
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {listHeader}
          <Separator size="4" mb="3" />
          {listBody}
        </Card>
        {inspectorCard}
      </Grid>
    )
  }

  return (
    <Flex
      ref={containerRef}
      gap="2"
      align="stretch"
      style={{
        height: '100%',
        minHeight: 0,
        position: 'relative',
        flex: 1,
      }}
    >
      <Card
        size="3"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: isMinimized ? '60px' : `${leftWidth}%`,
          height: '100%',
          minWidth: isMinimized ? '60px' : '300px',
          maxWidth: isMinimized ? '60px' : '75%',
          minHeight: 0,
          flexShrink: 0,
          transition: isResizing ? 'none' : 'width 0.1s ease-out',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isMinimized ? (
          <Box
            onClick={expandFromBar}
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
              inset: 0,
              cursor: 'pointer',
              zIndex: 1,
            }}
          >
            <Box
              data-glowing-bar
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
                transition: 'width 160ms ease-out',
                boxShadow:
                  '0 0 8px var(--accent-a5), 0 0 12px var(--accent-a4)',
              }}
            />
          </Box>
        ) : (
          <>
            {listHeader}
            <Separator size="4" mb="3" />
            {listBody}
          </>
        )}
      </Card>

      {!isMinimized && (
        <Box
          className="section-resizer"
          onMouseDown={(e) => {
            e.preventDefault()
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
              e.currentTarget.style.cursor = 'col-resize'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
            }
          }}
        />
      )}

      {inspectorCard}
    </Flex>
  )
}
