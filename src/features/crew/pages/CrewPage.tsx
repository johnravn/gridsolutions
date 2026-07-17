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
import ScrollToTopButton from '@shared/ui/components/ScrollToTopButton'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import { MOBILE_CARD_HEIGHT } from '@app/layout/mobileLayout'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'
import { SPLIT_LEFT_WIDTH, SplitPage, SplitPageSkeleton, useSplitLayout } from '@app/layout/split'
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
  const [showEmployees, setShowEmployees] = React.useState(true)
  const [showFreelancers, setShowFreelancers] = React.useState(true)
  const [showMyPending, setShowMyPending] = React.useState(true)
  const inspectorRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLElement>(null)

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

  React.useEffect(() => {
    if (!isLarge && selectedUserId != null && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [isLarge, selectedUserId])

  const clearSelection = React.useCallback(() => {
    setSelectedUserId(null)
  }, [])

  useMobileDetailBack(!isLarge, selectedUserId != null, clearSelection)

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

  if (!companyId || (showInitialSkeleton && !hasSlots)) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.crew}
        title="Crew"
      />
    )
  }

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

  const table = (
    <CrewTable
      createShortcutRef={createCrewShortcutRef}
      selectedUserId={selectedUserId}
      onSelect={setSelectedUserId}
      showEmployees={showEmployees}
      showFreelancers={showFreelancers}
      showMyPending={showMyPending}
      internalNotesByUserId={
        canSeeInternalNotes ? internalNotesByUserId : undefined
      }
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
      mobileLeftCardStyle={{
        height: MOBILE_CARD_HEIGHT,
        minWidth: 0,
      }}
      mobileLeftBodyStyle={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      mobileRightCardStyle={{
        height: MOBILE_CARD_HEIGHT,
        overflow: 'hidden',
        maxWidth: '100%',
      }}
      mobileSectionRef={listRef}
      mobileRightWrapper={(card) => (
        <div
          ref={inspectorRef}
          style={{
            minHeight: 0,
            maxWidth: '100%',
            width: '100%',
            height: MOBILE_CARD_HEIGHT,
          }}
        >
          {card}
        </div>
      )}
      mobileFooter={
        <ScrollToTopButton
          listRef={listRef}
          inspectorRef={inspectorRef}
          visible={!isLarge}
        />
      }
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
