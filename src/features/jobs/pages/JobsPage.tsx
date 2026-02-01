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
import { useQuery } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { TransitionLeft } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { companyExpansionQuery } from '@features/company/api/queries'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import {
  getModShortcutLabel,
  useModKeyShortcut,
} from '@shared/lib/keyboardShortcuts'
import JobsTable from '../components/JobsTable'
import JobInspector from '../components/JobInspector'

export default function JobsPage() {
  const { companyId } = useCompany()
  const location = useLocation()
  const search = location.search as { jobId?: string; tab?: string }
  const jobId = search?.jobId
  const tab = search?.tab

  // Fetch company expansion for vehicle/transport rates with extensive logging
  const expansionQueryOptions = React.useMemo(() => {
    if (!companyId) return null
    const baseOptions = companyExpansionQuery({ companyId })
    return {
      ...baseOptions,
      queryFn: async () => {
        const timestamp = new Date().toISOString()
        console.log('[JobsPage] Fetching company expansion', {
          companyId,
          timestamp,
          queryKey: baseOptions.queryKey,
        })
        try {
          const result = await baseOptions.queryFn()
          console.log('[JobsPage] Fetched company expansion result', {
            companyId,
            timestamp: new Date().toISOString(),
            result,
          })
          return result
        } catch (err) {
          console.error('[JobsPage] Company expansion fetch failed', {
            companyId,
            timestamp: new Date().toISOString(),
            error: err,
          })
          throw err
        }
      },
    }
  }, [companyId])

  const {
    data: companyExpansion,
    status: companyExpansionStatus,
    error: companyExpansionError,
    isFetching: isCompanyExpansionFetching,
    isLoading: isCompanyExpansionLoading,
    isError: isCompanyExpansionError,
  } = useQuery({
    ...(expansionQueryOptions ?? {
      queryKey: ['company-expansion', 'no-company'],
      queryFn: async () => null,
    }),
    enabled: !!companyId,
  })

  React.useEffect(() => {
    console.log('[JobsPage] companyId updated', {
      companyId,
      timestamp: new Date().toISOString(),
    })
  }, [companyId])

  React.useEffect(() => {
    console.log('[JobsPage] Company expansion query status changed', {
      status: companyExpansionStatus,
      isLoading: isCompanyExpansionLoading,
      isFetching: isCompanyExpansionFetching,
      isError: isCompanyExpansionError,
      error: companyExpansionError ?? null,
      timestamp: new Date().toISOString(),
    })
  }, [
    companyExpansionStatus,
    isCompanyExpansionLoading,
    isCompanyExpansionFetching,
    isCompanyExpansionError,
    companyExpansionError,
  ])

  // Log vehicle/transport rates when fetched
  React.useEffect(() => {
    if (companyExpansion) {
      console.log('[JobsPage] Vehicle/Transport Rates fetched', {
        vehicle_daily_rate: companyExpansion.vehicle_daily_rate,
        vehicle_distance_rate: companyExpansion.vehicle_distance_rate,
        vehicle_distance_increment: companyExpansion.vehicle_distance_increment,
        raw: companyExpansion,
        timestamp: new Date().toISOString(),
      })
    }
  }, [companyExpansion])

  const [selectedId, setSelectedId] = React.useState<string | null>(
    jobId || null,
  )

  // Update selectedId when jobId from URL changes
  React.useEffect(() => {
    if (jobId) {
      setSelectedId(jobId)
    }
  }, [jobId])

  // match InventoryPage behavior
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

  // Resize state: track left panel width as percentage (default 45/55 split)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(45)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [savedWidth, setSavedWidth] = React.useState<number>(45) // Save width when minimizing
  const [isResizing, setIsResizing] = React.useState(false)
  const [hasUserResized, setHasUserResized] = React.useState(false) // Track if user manually resized
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Toggle minimize state
  const toggleMinimize = React.useCallback(() => {
    if (isMinimized) {
      // Expand
      setLeftPanelWidth(savedWidth || 45)
      setIsMinimized(false)
    } else {
      // Minimize
      setSavedWidth(leftPanelWidth)
      setIsMinimized(true)
    }
  }, [isMinimized, savedWidth, leftPanelWidth])

  const collapseShortcutLabel = getModShortcutLabel('B')
  useModKeyShortcut({ key: 'b', enabled: isLarge, onTrigger: toggleMinimize })

  // Expand when clicking on glowing bar
  const handleGlowingBarClick = React.useCallback(() => {
    if (isMinimized) {
      setLeftPanelWidth(savedWidth || 45)
      setIsMinimized(false)
    }
  }, [isMinimized, savedWidth])

  // Handle optimal width change from table
  const handleTableWidthChange = React.useCallback(
    (width: number) => {
      // Only auto-update width if user hasn't manually resized
      if (!hasUserResized && !isMinimized) {
        setLeftPanelWidth(width)
        setSavedWidth(width)
      }
    },
    [hasUserResized, isMinimized],
  )

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
      // Min 15%, Max 75% to prevent panels from getting too small
      const minWidth = 15
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )

      setLeftPanelWidth(newWidthPercent)
      // Update saved width if user manually resizes
      setSavedWidth(newWidthPercent)
      // Mark that user has manually resized
      setHasUserResized(true)
      // Clear minimized state if user manually expands beyond threshold
      if (isMinimized && newWidthPercent > 35) {
        setIsMinimized(false)
      }
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

  if (!companyId) return <PageSkeleton columns="2fr 3fr" />

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <section
        style={{
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <Grid
          columns="1fr"
          gap="4"
          align="stretch"
          style={{
            height: isLarge ? '100%' : undefined,
            minHeight: 0,
          }}
        >
          {/* LEFT: Jobs table */}
          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: isLarge ? '100%' : undefined,
              minHeight: 0,
            }}
          >
            <Heading size="5" mb="3">
              Jobs
            </Heading>
            <Separator size="4" mb="3" />
            <Box
              style={{
                flex: isLarge ? 1 : undefined,
                minHeight: isLarge ? 0 : undefined,
                overflowY: isLarge ? 'auto' : 'visible',
              }}
            >
              <JobsTable
                selectedId={selectedId}
                onSelect={setSelectedId}
                onWidthChange={isLarge ? handleTableWidthChange : undefined}
              />
            </Box>
          </Card>

          {/* RIGHT: Inspector */}
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
              <JobInspector
                id={selectedId}
                onDeleted={() => setSelectedId(null)}
                initialTab={tab}
              />
            </Box>
          </Card>
        </Grid>
      </section>
    )
  }

  // On large screens, use resizable flex layout
  return (
    <section
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Flex
        ref={containerRef}
        gap="2"
        align="stretch"
        style={{
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* LEFT: Jobs table */}
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
            transition: isResizing ? 'none' : 'width 0.2s ease-out',
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
                if (bar) {
                  bar.style.width = '24px'
                }
              }}
              onMouseLeave={(e) => {
                const bar = e.currentTarget.querySelector(
                  '[data-glowing-bar]',
                ) as HTMLElement
                if (bar) {
                  bar.style.width = '12px'
                }
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
              {/* Glowing vertical bar skeleton with animation */}
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
                <Heading size="5">Jobs</Heading>
                <Tooltip
                  content={`Collapse sidebar (${collapseShortcutLabel})`}
                >
                  <IconButton
                    size="3"
                    variant="ghost"
                    onClick={toggleMinimize}
                    style={{
                      flexShrink: 0,
                    }}
                  >
                    <TransitionLeft width={22} height={22} />
                  </IconButton>
                </Tooltip>
              </Flex>
              <Separator size="4" mb="3" />
              <Box
                style={{
                  flex: isLarge ? 1 : undefined,
                  minHeight: isLarge ? 0 : undefined,
                  overflowY: isLarge ? 'auto' : 'visible',
                }}
              >
                <JobsTable
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onWidthChange={isLarge ? handleTableWidthChange : undefined}
                />
              </Box>
            </>
          )}
        </Card>

        {/* RESIZER - hidden when minimized */}
        {!isMinimized && (
          <Box
            className="section-resizer"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
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

        {/* RIGHT: Inspector */}
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
            <JobInspector
              id={selectedId}
              onDeleted={() => setSelectedId(null)}
              initialTab={tab}
            />
          </Box>
        </Card>
      </Flex>
    </section>
  )
}
