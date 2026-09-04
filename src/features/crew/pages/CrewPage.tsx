import * as React from 'react'
import {
  Box,
  Checkbox,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useQuery } from '@tanstack/react-query'
import { Filter } from 'iconoir-react'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useRegisterShortcutAction } from '@shared/hotkeys'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import {
  MobileSplitSkeleton,
  MobileSplitView,
  useMobileInspectorDrawer,
} from '@app/layout/mobile'
import {
  SPLIT_LEFT_WIDTH,
  SplitPage,
  SplitPageSkeleton,
  useSplitLayout,
} from '@app/layout/split'
import CrewTable from '../components/CrewTable'
import CrewInspector from '../components/CrewInspector'
import {
  crewIndexQuery,
  crewInternalNotesQuery,
  pendingInvitesQuery,
} from '../api/queries'

export default function CrewPage() {
  const { companyId } = useCompany()
  const { companyRole, isGlobalSuperuser } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const { isLarge, hasSlots } = useSplitLayout()
  const createCrewShortcutRef = React.useRef<(() => void) | null>(null)
  useRegisterShortcutAction(
    'create.crew',
    () => createCrewShortcutRef.current?.(),
    canWrite,
  )
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null,
  )
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)
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

  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedUserId(id)
      openDrawer()
    },
    [openDrawer],
  )

  const { isLoading: empLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'employee' }),
    enabled: !!companyId && showEmployees,
  })
  const { isLoading: frLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'freelancer' }),
    enabled: !!companyId && showFreelancers,
  })
  const { isLoading: owLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'owner' }),
    enabled: !!companyId,
  })
  const { isLoading: invLoading } = useQuery({
    ...pendingInvitesQuery({ companyId: companyId! }),
    enabled: !!companyId && showMyPending,
  })
  const crewIndexLoading = empLoading || frLoading || owLoading || invLoading
  const showInitialSkeleton = useInitialPageLoad(crewIndexLoading)

  const filter = (
    <CrewFilter
      showEmployees={showEmployees}
      showFreelancers={showFreelancers}
      showMyPending={showMyPending}
      onShowEmployeesChange={setShowEmployees}
      onShowFreelancersChange={setShowFreelancers}
      onShowMyPendingChange={setShowMyPending}
    />
  )

  if (!companyId) {
    if (!isLarge) return <MobileSplitSkeleton />
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.crew}
        title="Crew"
      />
    )
  }

  if (showInitialSkeleton && !isLarge) {
    return <MobileSplitSkeleton />
  }

  if (showInitialSkeleton && !hasSlots) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.crew}
        title="Crew"
      />
    )
  }

  const table = (
    <CrewTable
      createShortcutRef={createCrewShortcutRef}
      selectedUserId={selectedUserId}
      onSelect={isLarge ? setSelectedUserId : handleSelect}
      showEmployees={showEmployees}
      showFreelancers={showFreelancers}
      showMyPending={showMyPending}
      internalNotesByUserId={
        canSeeInternalNotes ? internalNotesByUserId : undefined
      }
      toolbarExtra={isLarge ? undefined : filter}
    />
  )

  const inspector = (
    <CrewInspector
      userId={selectedUserId}
      internalNote={
        canSeeInternalNotes && selectedUserId
          ? (internalNotesByUserId[selectedUserId] ?? null)
          : null
      }
    />
  )

  if (!isLarge) {
    return (
      <MobileSplitView
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onToggle={toggleDrawer}
        inspector={inspector}
      >
        {table}
      </MobileSplitView>
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.crew}
      title="Crew"
      leftToolbar={filter}
      left={table}
      leftBodyStyle={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      right={inspector}
    />
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
          <IconButton
            className="split-header-icon-button"
            variant="ghost"
            size="3"
            aria-label="Filter crew"
          >
            <Filter width={22} height={22} />
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
                fontSize: 'var(--font-size-1)',
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
