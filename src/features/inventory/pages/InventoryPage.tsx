// src/features/inventory/pages/InventoryPage.tsx
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
import { useLocation } from '@tanstack/react-router'
import { useCompany } from '@shared/companies/CompanyProvider'
import { Filter, TransitionLeft } from 'iconoir-react'
import {
  getModShortcutLabel,
  useModKeyShortcut,
} from '@shared/lib/keyboardShortcuts'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import InventoryTable from '../components/InventoryTable'
import InventoryInspector from '../components/InventoryInspector'

export default function InventoryPage() {
  const { companyId } = useCompany()
  const location = useLocation()
  const search = location.search as { inventoryId?: string }
  const inventoryId = search?.inventoryId

  const [selectedId, setSelectedId] = React.useState<string | null>(
    inventoryId || null,
  )

  // Update selectedId when inventoryId from URL changes
  React.useEffect(() => {
    if (inventoryId) {
      setSelectedId(inventoryId)
    }
  }, [inventoryId])
  const [showActive, setShowActive] = React.useState(true)
  const [showInactive, setShowInactive] = React.useState(false)
  const [showInternal, setShowInternal] = React.useState(true)
  const [showExternal, setShowExternal] = React.useState(true)
  const [showGroupOnlyItems, setShowGroupOnlyItems] = React.useState(false)
  const [showGroups, setShowGroups] = React.useState(true)
  const [showItems, setShowItems] = React.useState(true)

  // Responsive toggle for >= 1024px (large screens)
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )

  // Resize state: track left panel width as percentage (default 66.67% for 2fr/3fr ratio)
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

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    // Safari <14 fallback
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

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

  if (!companyId) return <PageSkeleton columns="2fr 1fr" />

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
              <Heading size="5">Overview</Heading>
              <InventoryFilter
                showActive={showActive}
                showInactive={showInactive}
                showInternal={showInternal}
                showExternal={showExternal}
                showGroupOnlyItems={showGroupOnlyItems}
                showGroups={showGroups}
                showItems={showItems}
                onShowActiveChange={setShowActive}
                onShowInactiveChange={setShowInactive}
                onShowInternalChange={setShowInternal}
                onShowExternalChange={setShowExternal}
                onShowGroupOnlyItemsChange={setShowGroupOnlyItems}
                onShowGroupsChange={setShowGroups}
                onShowItemsChange={setShowItems}
              />
            </Flex>

            <Separator size="4" mb="3" />

            <Box
              style={{
                flex: isLarge ? 1 : undefined,
                minHeight: isLarge ? 0 : undefined,
                overflowY: isLarge ? 'auto' : 'visible',
              }}
            >
              <InventoryTable
                selectedId={selectedId}
                onSelect={setSelectedId}
                showActive={showActive}
                showInactive={showInactive}
                showInternal={showInternal}
                showExternal={showExternal}
                showGroupOnlyItems={showGroupOnlyItems}
                showGroups={showGroups}
                showItems={showItems}
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
              <InventoryInspector id={selectedId} />
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
        {/* LEFT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: isMinimized ? '60px' : `${leftPanelWidth}%`,
            height: isLarge ? '100%' : undefined,
            minWidth: isMinimized ? '60px' : '300px', // Prevent panel from getting too small
            maxWidth: isMinimized ? '60px' : '75%', // Enforce max width
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
                <Heading size="5">Overview</Heading>
                <Flex align="center" gap="2">
                  <InventoryFilter
                    showActive={showActive}
                    showInactive={showInactive}
                    showInternal={showInternal}
                    showExternal={showExternal}
                    showGroupOnlyItems={showGroupOnlyItems}
                    showGroups={showGroups}
                    showItems={showItems}
                    onShowActiveChange={setShowActive}
                    onShowInactiveChange={setShowInactive}
                    onShowInternalChange={setShowInternal}
                    onShowExternalChange={setShowExternal}
                    onShowGroupOnlyItemsChange={setShowGroupOnlyItems}
                    onShowGroupsChange={setShowGroups}
                    onShowItemsChange={setShowItems}
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
                  flex: isLarge ? 1 : undefined,
                  minHeight: isLarge ? 0 : undefined,
                  overflowY: isLarge ? 'auto' : 'visible',
                }}
              >
                <InventoryTable
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  showActive={showActive}
                  showInactive={showInactive}
                  showInternal={showInternal}
                  showExternal={showExternal}
                  showGroupOnlyItems={showGroupOnlyItems}
                  showGroups={showGroups}
                  showItems={showItems}
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
              margin: '0 -4px', // Extend into gap for easier clicking
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
            minWidth: '300px', // Prevent panel from getting too small
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
            <InventoryInspector id={selectedId} />
          </Box>
        </Card>
      </Flex>
    </section>
  )
}

function InventoryFilter({
  showActive,
  showInactive,
  showInternal,
  showExternal,
  showGroupOnlyItems,
  showGroups,
  showItems,
  onShowActiveChange,
  onShowInactiveChange,
  onShowInternalChange,
  onShowExternalChange,
  onShowGroupOnlyItemsChange,
  onShowGroupsChange,
  onShowItemsChange,
}: {
  showActive: boolean
  showInactive: boolean
  showInternal: boolean
  showExternal: boolean
  showGroupOnlyItems: boolean
  showGroups: boolean
  showItems: boolean
  onShowActiveChange: (v: boolean) => void
  onShowInactiveChange: (v: boolean) => void
  onShowInternalChange: (v: boolean) => void
  onShowExternalChange: (v: boolean) => void
  onShowGroupOnlyItemsChange: (v: boolean) => void
  onShowGroupsChange: (v: boolean) => void
  onShowItemsChange: (v: boolean) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedCount = [
    showActive,
    showInactive,
    showInternal,
    showExternal,
    showGroupOnlyItems,
    showGroups,
    showItems,
  ].filter(Boolean).length
  const activeFiltersCount = selectedCount < 7 ? selectedCount : 0

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
        <DropdownMenu.Label>Status</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowActiveChange(!showActive)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showActive}
              onCheckedChange={onShowActiveChange}
            />
            <Text>Active</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowInactiveChange(!showInactive)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showInactive}
              onCheckedChange={onShowInactiveChange}
            />
            <Text>Inactive</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Ownership</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowInternalChange(!showInternal)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showInternal}
              onCheckedChange={onShowInternalChange}
            />
            <Text>Internal</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowExternalChange(!showExternal)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showExternal}
              onCheckedChange={onShowExternalChange}
            />
            <Text>External</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Type</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowGroupOnlyItemsChange(!showGroupOnlyItems)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showGroupOnlyItems}
              onCheckedChange={onShowGroupOnlyItemsChange}
            />
            <Text>Group-only items</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowGroupsChange(!showGroups)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showGroups}
              onCheckedChange={onShowGroupsChange}
            />
            <Text>Groups</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowItemsChange(!showItems)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={showItems} onCheckedChange={onShowItemsChange} />
            <Text>Items</Text>
          </Flex>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
