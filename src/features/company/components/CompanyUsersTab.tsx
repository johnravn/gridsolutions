// src/features/company/components/CompanyUsersTab.tsx
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
import { useCompany } from '@shared/companies/CompanyProvider'
import { TransitionLeft } from 'iconoir-react'
import {
  getModShortcutLabel,
  useModKeyShortcut,
} from '@shared/lib/keyboardShortcuts'
import CrewInspector from '../../crew/components/CrewInspector'
import CompanyTable from './CompanyTable'
import CompanyUsersFilter from './CompanyUsersFilter'

type Selection = { kind: 'user'; userId: string } | { kind: 'none' }

export default function CompanyUsersTab() {
  const { companyId } = useCompany()
  const [selection, setSelection] = React.useState<Selection>({ kind: 'none' })

  // ⬇️ Same filters as before
  const [showEmployees, setShowEmployees] = React.useState(true)
  const [showFreelancers, setShowFreelancers] = React.useState(true)
  const [showMyPending, setShowMyPending] = React.useState(true)

  // same responsive pattern
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // Resize state: track left panel width as percentage (default 66.67% for 2fr/1fr ratio)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(66.67)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [savedWidth, setSavedWidth] = React.useState<number>(66.67)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const toggleMinimize = React.useCallback(() => {
    if (isMinimized) {
      setLeftPanelWidth(savedWidth || 66.67)
      setIsMinimized(false)
    } else {
      setSavedWidth(leftPanelWidth)
      setIsMinimized(true)
    }
  }, [isMinimized, leftPanelWidth, savedWidth])

  const handleGlowingBarClick = React.useCallback(() => {
    if (isMinimized) {
      setLeftPanelWidth(savedWidth || 66.67)
      setIsMinimized(false)
    }
  }, [isMinimized, savedWidth])

  const collapseShortcutLabel = getModShortcutLabel('B')
  useModKeyShortcut({ key: 'b', enabled: isLarge, onTrigger: toggleMinimize })

  // Handle mouse move for resizing
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width

      // Calculate mouse position relative to container
      const mouseX = e.clientX - containerRect.left

      // Calculate new left panel width percentage
      // Min 25%, Max 75% to prevent panels from getting too small
      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )

      setLeftPanelWidth(newWidthPercent)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // Restore cursor and text selection
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Set global cursor and prevent text selection during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Cleanup in case component unmounts during resize
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  if (!companyId) return <div>No company selected.</div>

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <Grid
        columns="1fr"
        gap="4"
        align="stretch"
        style={{
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
          flex: isLarge ? 1 : undefined,
        }}
      >
        {/* LEFT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: isLarge ? '100%' : undefined,
            minHeight: 0,
          }}
        >
          <Flex align="center" justify="between" mb="3">
            <Heading size="5">Users</Heading>
            <CompanyUsersFilter
              showEmployees={showEmployees}
              showFreelancers={showFreelancers}
              showMyPending={showMyPending}
              onShowEmployeesChange={setShowEmployees}
              onShowFreelancersChange={setShowFreelancers}
              onShowMyPendingChange={setShowMyPending}
            />
          </Flex>
          <Separator size="4" mb="3" />

          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CompanyTable
              selectedUserId={
                selection.kind === 'user' ? selection.userId : null
              }
              onSelectUser={(userId) => setSelection({ kind: 'user', userId })}
              showEmployees={showEmployees}
              showFreelancers={showFreelancers}
              showMyPending={showMyPending}
            />
          </Box>
        </Card>

        {/* RIGHT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: isLarge ? '100%' : undefined,
            maxHeight: isLarge ? '100%' : undefined,
            overflow: isLarge ? 'hidden' : 'visible',
            minHeight: 0,
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
            {selection.kind === 'user' ? (
              <CrewInspector userId={selection.userId} />
            ) : (
              <div style={{ color: 'var(--gray-11)' }}>
                Select an employee to view details.
              </div>
            )}
          </Box>
        </Card>
      </Grid>
    )
  }

  // On large screens, use resizable flex layout
  return (
    <Flex
      ref={containerRef}
      gap="2"
      align="stretch"
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
        position: 'relative',
        flex: isLarge ? 1 : undefined,
      }}
    >
      {/* LEFT */}
      <Card
        size="3"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: isMinimized ? '60px' : `${leftPanelWidth}%`,
          height: isLarge ? '100%' : undefined,
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
            onClick={handleGlowingBarClick}
            onMouseEnter={(e) => {
              const bar = e.currentTarget.querySelector(
                '[data-glowing-bar]',
              ) as HTMLElement
              if (bar) bar.style.width = '24px'
            }}
            onMouseLeave={(e) => {
              const bar = e.currentTarget.querySelector(
                '[data-glowing-bar]',
              ) as HTMLElement
              if (bar) bar.style.width = '12px'
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
                animation: 'glow-pulse 5s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes glow-pulse {
                0%, 100% {
                  box-shadow: 0 0 8px var(--accent-a5), 0 0 12px var(--accent-a4);
                }
                50% {
                  box-shadow: 0 0 12px var(--accent-a6), 0 0 18px var(--accent-a5);
                }
              }
            `}</style>
          </Box>
        ) : (
          <>
            <Flex align="center" justify="between" mb="3">
              <Heading size="5">Users</Heading>
              <Flex align="center" gap="2">
                <CompanyUsersFilter
                  showEmployees={showEmployees}
                  showFreelancers={showFreelancers}
                  showMyPending={showMyPending}
                  onShowEmployeesChange={setShowEmployees}
                  onShowFreelancersChange={setShowFreelancers}
                  onShowMyPendingChange={setShowMyPending}
                />
                <Tooltip
                  content={`Collapse sidebar (${collapseShortcutLabel})`}
                >
                  <IconButton
                    size="3"
                    variant="ghost"
                    onClick={toggleMinimize}
                    style={{ flexShrink: 0 }}
                  >
                    <TransitionLeft width={22} height={22} />
                  </IconButton>
                </Tooltip>
              </Flex>
            </Flex>
            <Separator size="4" mb="3" />

            <Box
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanyTable
                selectedUserId={
                  selection.kind === 'user' ? selection.userId : null
                }
                onSelectUser={(userId) =>
                  setSelection({ kind: 'user', userId })
                }
                showEmployees={showEmployees}
                showFreelancers={showFreelancers}
                showMyPending={showMyPending}
              />
            </Box>
          </>
        )}
      </Card>

      {/* RESIZER */}
      {!isMinimized && (
        <Box
          className="section-resizer"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
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

      {/* RIGHT */}
      <Card
        size="3"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          height: isLarge ? '100%' : undefined,
          maxHeight: isLarge ? '100%' : undefined,
          overflow: isLarge ? 'hidden' : 'visible',
          minWidth: '300px',
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
          {selection.kind === 'user' ? (
            <CrewInspector userId={selection.userId} />
          ) : (
            <div style={{ color: 'var(--gray-11)' }}>
              Select an employee to view details.
            </div>
          )}
        </Box>
      </Card>
    </Flex>
  )
}
