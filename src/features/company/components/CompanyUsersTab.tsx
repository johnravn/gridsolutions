// src/features/company/components/CompanyUsersTab.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { NavArrowDown } from 'iconoir-react'
import CrewInspector from '../../crew/components/CrewInspector'
import CompanyTable from './CompanyTable'

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
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

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
            <StatusDropdown
              showEmployees={showEmployees}
              showFreelancers={showFreelancers}
              showMyPending={showMyPending}
              onShowEmployeesChange={setShowEmployees}
              onShowFreelancersChange={setShowFreelancers}
              onShowMyPendingChange={setShowMyPending}
            />
          </Flex>
          <Separator size="4" mb="3" />

          {/* Employees/Freelancers/Invites table */}
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
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
          width: `${leftPanelWidth}%`,
          height: isLarge ? '100%' : undefined,
          minWidth: '300px',
          maxWidth: '75%',
          minHeight: 0,
          flexShrink: 0,
          transition: isResizing ? 'none' : 'width 0.1s ease-out',
        }}
      >
        <Flex align="center" justify="between" mb="3">
          <Heading size="5">Users</Heading>
          <StatusDropdown
            showEmployees={showEmployees}
            showFreelancers={showFreelancers}
            showMyPending={showMyPending}
            onShowEmployeesChange={setShowEmployees}
            onShowFreelancersChange={setShowFreelancers}
            onShowMyPendingChange={setShowMyPending}
          />
        </Flex>
        <Separator size="4" mb="3" />

        {/* Employees/Freelancers/Invites table */}
        <Box
          style={{
            flex: isLarge ? 1 : undefined,
            minHeight: isLarge ? 0 : undefined,
            overflowY: isLarge ? 'auto' : 'visible',
          }}
        >
          <CompanyTable
            selectedUserId={selection.kind === 'user' ? selection.userId : null}
            onSelectUser={(userId) => setSelection({ kind: 'user', userId })}
            showEmployees={showEmployees}
            showFreelancers={showFreelancers}
            showMyPending={showMyPending}
          />
        </Box>
      </Card>

      {/* RESIZER */}
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

function StatusDropdown({
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
  const selectedCount = [showEmployees, showFreelancers, showMyPending].filter(
    Boolean,
  ).length

  const label =
    selectedCount === 3
      ? 'All statuses'
      : selectedCount === 0
        ? 'No statuses'
        : `${selectedCount} selected`

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="soft" size="2">
          <Text>{label}</Text>
          <NavArrowDown width={14} height={14} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
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
