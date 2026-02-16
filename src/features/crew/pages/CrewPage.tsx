import * as React from 'react'
import {
  Box,
  Card,
  Checkbox,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  IconButton,
  Separator,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useQuery } from '@tanstack/react-query'
import { Filter, TransitionLeft } from 'iconoir-react'
import {
  getModShortcutLabel,
  useModKeyShortcut,
} from '@shared/lib/keyboardShortcuts'
import CrewTable from '../components/CrewTable'
import CrewInspector from '../components/CrewInspector'
import { crewInternalNotesQuery } from '../api/queries'

export default function CrewPage() {
  const { companyId } = useCompany()
  const { companyRole, isGlobalSuperuser } = useAuthz()
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null,
  )
  const [showEmployees, setShowEmployees] = React.useState(true)
  const [showFreelancers, setShowFreelancers] = React.useState(true)
  const [showMyPending, setShowMyPending] = React.useState(true)

  const canSeeInternalNotes =
    !!isGlobalSuperuser ||
    companyRole === 'owner' ||
    companyRole === 'employee' ||
    companyRole === 'super_user'

  const { data: internalNotes = [] } = useQuery({
    ...(companyId
      ? crewInternalNotesQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'crew-internal-notes'] as const,
          queryFn: () => Promise.resolve([]),
        }),
    enabled: !!companyId && canSeeInternalNotes,
  })

  const internalNotesByUserId = React.useMemo(() => {
    const m: Record<string, string> = {}
    for (const n of internalNotes) {
      if (n.note && n.note.trim()) m[n.user_id] = n.note
    }
    return m
  }, [internalNotes])

  // same responsive pattern as InventoryPage
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
      <section style={{ minHeight: 0 }}>
        <Grid
          columns="1fr"
          gap="4"
          align="stretch"
          style={{
            minHeight: 0,
          }}
        >
          {/* LEFT */}
          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Flex align="center" justify="between" mb="3">
              <Heading size="5">Crew</Heading>
              <CrewFilter
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
              <CrewTable
                selectedUserId={selectedUserId}
                onSelect={setSelectedUserId}
                showEmployees={showEmployees}
                showFreelancers={showFreelancers}
                showMyPending={showMyPending}
                internalNotesByUserId={
                  canSeeInternalNotes ? internalNotesByUserId : undefined
                }
              />
            </Box>
          </Card>

          {/* RIGHT */}
          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
              minHeight: 0,
            }}
          >
            <Heading size="5" mb="3">
              Inspector
            </Heading>
            <Separator size="4" mb="3" />
            <Box
              style={{
                overflowY: 'visible',
              }}
            >
              <CrewInspector
                userId={selectedUserId}
                internalNote={
                  canSeeInternalNotes && selectedUserId
                    ? (internalNotesByUserId[selectedUserId] ?? null)
                    : null
                }
              />
            </Box>
          </Card>
        </Grid>
      </section>
    )
  }

  // On large screens, use resizable flex layout
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
        {/* LEFT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: isMinimized ? '60px' : `${leftPanelWidth}%`,
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
                <Heading size="5">Crew</Heading>
                <Flex align="center" gap="2">
                  <CrewFilter
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
                <CrewTable
                  selectedUserId={selectedUserId}
                  onSelect={setSelectedUserId}
                  showEmployees={showEmployees}
                  showFreelancers={showFreelancers}
                  showMyPending={showMyPending}
                  internalNotesByUserId={
                    canSeeInternalNotes ? internalNotesByUserId : undefined
                  }
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
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
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
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <CrewInspector
              userId={selectedUserId}
              internalNote={
                canSeeInternalNotes && selectedUserId
                  ? (internalNotesByUserId[selectedUserId] ?? null)
                  : null
              }
            />
          </Box>
        </Card>
      </Flex>
    </section>
  )
}

function CrewFilter({
  showEmployees,
  showFreelancers,
  showMyPending,
  onShowEmployeesChange,
  onShowFreelancersChange,
  onShowMyPendingChange,
}: {
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
  onShowEmployeesChange: (v: boolean) => void
  onShowFreelancersChange: (v: boolean) => void
  onShowMyPendingChange: (v: boolean) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedCount = [showEmployees, showFreelancers, showMyPending].filter(
    Boolean,
  ).length
  const activeFiltersCount = selectedCount < 3 ? selectedCount : 0

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger>
        <Box style={{ position: 'relative', display: 'inline-block' }}>
          <IconButton variant="soft" size="2">
            <Filter width={16} height={16} />
          </IconButton>
          {activeFiltersCount > 0 && (
            <Box
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-9)',
                color: 'white',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeFiltersCount}
            </Box>
          )}
        </Box>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowEmployeesChange(!showEmployees)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showEmployees}
              onCheckedChange={onShowEmployeesChange}
            />
            <Text>Employees</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowFreelancersChange(!showFreelancers)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showFreelancers}
              onCheckedChange={onShowFreelancersChange}
            />
            <Text>Freelancers</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowMyPendingChange(!showMyPending)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showMyPending}
              onCheckedChange={onShowMyPendingChange}
            />
            <Text>Pending invites</Text>
          </Flex>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
