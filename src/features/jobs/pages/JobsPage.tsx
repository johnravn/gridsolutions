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
import { CalendarXmark, TransitionLeft } from 'iconoir-react'
import { DatePicker } from '@shared/ui/components/pickers'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { companyExpansionQuery } from '@features/company/api/queries'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import {
  getModShortcutLabel,
  useModKeyShortcut,
} from '@shared/lib/keyboardShortcuts'
import ScrollToTopButton from '@shared/ui/components/ScrollToTopButton'
import { MOBILE_CARD_HEIGHT } from '@app/layout/mobileLayout'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'
import JobsList from '../components/JobsList'
import JobsFilter, { DEFAULT_STATUS_FILTER } from '../components/JobsFilter'
import JobInspector from '../components/JobInspector'
import RecurringJobInspector from '../components/RecurringJobInspector'
import { jobsIndexQuery } from '../api/queries'
import type { JobsPageSelection } from '../types'

export default function JobsPage() {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const location = useLocation()
  const search = location.search as Record<string, unknown>
  const jobId = (search.jobId as string | undefined) || undefined
  const recurringJobId =
    (search.recurringJobId as string | undefined) || undefined
  const tab = (search.tab as string | undefined) || undefined

  // Fetch company expansion for vehicle/transport rates
  const expansionQueryOptions = React.useMemo(() => {
    if (!companyId) return null
    return companyExpansionQuery({ companyId })
  }, [companyId])

  useQuery({
    ...(expansionQueryOptions ?? {
      queryKey: ['company-expansion', 'no-company'],
      queryFn: async () => null,
    }),
    enabled: !!companyId,
  })

  const [selection, setSelection] = React.useState<JobsPageSelection>(() => {
    if (recurringJobId) return { kind: 'recurring_job', id: recurringJobId }
    if (jobId) return { kind: 'job', id: jobId }
    return null
  })
  const [statusFilter, setStatusFilter] = React.useState(DEFAULT_STATUS_FILTER)
  const [showOnlyArchived, setShowOnlyArchived] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<string>('')

  // Update selection when URL search params change
  React.useEffect(() => {
    if (recurringJobId) {
      setSelection({ kind: 'recurring_job', id: recurringJobId })
    } else if (jobId) {
      setSelection({ kind: 'job', id: jobId })
    }
  }, [jobId, recurringJobId])

  const handleSelectJob = React.useCallback((id: string | null) => {
    setSelection(id ? { kind: 'job', id } : null)
  }, [])

  const handleSelectRecurringJob = React.useCallback((id: string | null) => {
    setSelection(id ? { kind: 'recurring_job', id } : null)
  }, [])

  const handleSelectJobFromRecurring = React.useCallback((id: string) => {
    setSelection({ kind: 'job', id })
  }, [])

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

  // Resize state: track left panel width as percentage (default 50/50 split)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(50)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [savedWidth, setSavedWidth] = React.useState<number>(50) // Save width when minimizing
  const [isResizing, setIsResizing] = React.useState(false)
  const [hasUserResized, setHasUserResized] = React.useState(false) // Track if user manually resized
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inspectorRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLElement>(null)

  // Toggle minimize state
  const toggleMinimize = React.useCallback(() => {
    if (isMinimized) {
      // Expand
      setLeftPanelWidth(savedWidth || 50)
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
      setLeftPanelWidth(savedWidth || 50)
      setIsMinimized(false)
    }
  }, [isMinimized, savedWidth])

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

  // On phone: when a job is selected, scroll to the inspector
  React.useEffect(() => {
    if (!isLarge && selection != null && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [isLarge, selection])

  const clearSelection = React.useCallback(() => {
    setSelection(null)
  }, [])

  useMobileDetailBack(!isLarge, selection != null, clearSelection)

  const { isLoading: jobsIndexLoading } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '__none__',
      search: '',
      selectedDate: '',
      sortBy: 'start_at',
      sortDir: 'asc',
      userId,
      companyRole,
      showOnlyArchived: false,
    }),
    enabled: !!companyId,
  })
  const showInitialSkeleton = useInitialPageLoad(jobsIndexLoading)

  if (!companyId || showInitialSkeleton)
    return <PageSkeleton columns="2fr 3fr" />

  if (!isLarge) {
    return (
      <section ref={listRef} style={{ minHeight: 0 }}>
        <Grid columns="1fr" gap="4" align="stretch" style={{ minHeight: 0 }}>
          {/* Jobs list + top bar: viewport height minus app chrome and padding */}
          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: MOBILE_CARD_HEIGHT,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Flex
              align="center"
              justify="between"
              mb="3"
              wrap="wrap"
              gap="2"
              style={{ flexShrink: 0 }}
            >
              <Heading size="5">Jobs</Heading>
              <Flex align="center" gap="2" wrap="wrap">
                {selectedDate ? (
                  <Tooltip
                    content={`Filter: ${new Date(selectedDate).toLocaleDateString()}`}
                  >
                    <IconButton
                      size="2"
                      variant="soft"
                      color="blue"
                      onClick={() => setSelectedDate('')}
                    >
                      <CalendarXmark width={16} height={16} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <DatePicker
                    value=""
                    onChange={(iso) => {
                      if (iso) {
                        const d = new Date(iso)
                        setSelectedDate(
                          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                        )
                      }
                    }}
                    iconButton
                    iconButtonSize="2"
                  />
                )}
                <JobsFilter
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  showOnlyArchived={showOnlyArchived}
                  onShowOnlyArchivedChange={setShowOnlyArchived}
                />
              </Flex>
            </Flex>
            <Separator size="4" mb="3" style={{ flexShrink: 0 }} />
            <Box
              style={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <JobsList
                selection={selection}
                onSelectJob={handleSelectJob}
                onSelectRecurringJob={handleSelectRecurringJob}
                statusFilter={statusFilter}
                showOnlyArchived={showOnlyArchived}
                selectedDate={selectedDate}
                compact
              />
            </Box>
          </Card>

          {/* Inspector: below the fold on mobile; same height as list so layout doesn't jump before content loads */}
          <div
            ref={inspectorRef}
            style={{
              minHeight: 0,
              maxWidth: '100%',
              width: '100%',
              height: MOBILE_CARD_HEIGHT,
            }}
          >
            <Card
              size="3"
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: isLarge ? '100%' : MOBILE_CARD_HEIGHT,
                maxHeight: isLarge ? '100%' : undefined,
                overflow: isLarge ? 'hidden' : 'hidden',
                minHeight: 0,
                maxWidth: '100%',
              }}
            >
              <Heading size="5" mb="3" style={{ flexShrink: 0 }}>
                Inspector
              </Heading>
              <Separator size="4" mb="3" style={{ flexShrink: 0 }} />
              <Box
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  minWidth: 0,
                  maxWidth: '100%',
                }}
              >
                {selection?.kind === 'recurring_job' ? (
                  <RecurringJobInspector
                    id={selection.id}
                    onSelectJob={handleSelectJobFromRecurring}
                    onArchived={() => setSelection(null)}
                    onDeleted={() => setSelection(null)}
                  />
                ) : (
                  <JobInspector
                    id={selection?.kind === 'job' ? selection.id : null}
                    onDeleted={() => setSelection(null)}
                    initialTab={tab}
                  />
                )}
              </Box>
            </Card>
          </div>
        </Grid>
        <ScrollToTopButton
          listRef={listRef}
          inspectorRef={inspectorRef}
          visible={!isLarge}
        />
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
              <Flex align="center" justify="between" mb="3" wrap="wrap" gap="2">
                <Heading size="5">Jobs</Heading>
                <Flex align="center" gap="2" wrap="wrap">
                  {selectedDate ? (
                    <Tooltip
                      content={`Filter: ${new Date(selectedDate).toLocaleDateString()}`}
                    >
                      <IconButton
                        size="2"
                        variant="soft"
                        color="blue"
                        onClick={() => setSelectedDate('')}
                      >
                        <CalendarXmark width={16} height={16} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <DatePicker
                      value=""
                      onChange={(iso) => {
                        if (iso) {
                          const d = new Date(iso)
                          setSelectedDate(
                            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                          )
                        }
                      }}
                      iconButton
                      iconButtonSize="2"
                    />
                  )}
                  <JobsFilter
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    showOnlyArchived={showOnlyArchived}
                    onShowOnlyArchivedChange={setShowOnlyArchived}
                  />
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
              </Flex>
              <Separator size="4" mb="3" />
              <Box
                style={{
                  flex: isLarge ? 1 : undefined,
                  minHeight: isLarge ? 0 : undefined,
                  overflow: isLarge ? 'hidden' : 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <JobsList
                  selection={selection}
                  onSelectJob={handleSelectJob}
                  onSelectRecurringJob={handleSelectRecurringJob}
                  statusFilter={statusFilter}
                  showOnlyArchived={showOnlyArchived}
                  selectedDate={selectedDate}
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
            {selection?.kind === 'recurring_job' ? (
              <RecurringJobInspector
                id={selection.id}
                onSelectJob={handleSelectJobFromRecurring}
                onArchived={() => setSelection(null)}
                onDeleted={() => setSelection(null)}
              />
            ) : (
              <JobInspector
                id={selection?.kind === 'job' ? selection.id : null}
                onDeleted={() => setSelection(null)}
                initialTab={tab}
              />
            )}
          </Box>
        </Card>
      </Flex>
    </section>
  )
}
