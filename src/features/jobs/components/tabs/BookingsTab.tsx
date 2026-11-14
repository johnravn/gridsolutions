import { Box, SegmentedControl, Tabs } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import { useAuthz } from '@shared/auth/useAuthz'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { jobDetailQuery } from '@features/jobs/api/queries'
import { JobBookingConflictsBanner } from '@features/conflicts/components/JobBookingConflictsBanner'
import EquipmentTab from './EquipmentTab'
import CrewTab from './CrewTab'
import TransportTab from './TransportTab'

export const BOOKINGS_SUB_TABS = ['crew', 'equipment', 'transport'] as const

export default function BookingsTab({
  jobId,
  activeSubTab,
  onSubTabChange,
}: {
  jobId: string
  activeSubTab: string
  onSubTabChange: (subTab: string) => void
}) {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
  })

  const isProjectLead = !!userId && job?.project_lead?.user_id === userId
  const showConflictsBanner = companyRole !== 'freelancer'

  return (
    <Tabs.Root value={activeSubTab} onValueChange={onSubTabChange}>
      {showConflictsBanner && (
        <JobBookingConflictsBanner
          jobId={jobId}
          isProjectLead={isProjectLead}
          onNavigateSubTab={onSubTabChange}
        />
      )}

      {isMobile ? (
        <Box mb="3">
          <SegmentedControl.Root
            value={activeSubTab}
            onValueChange={onSubTabChange}
            size="2"
            style={{ width: '100%', display: 'flex' }}
          >
            <SegmentedControl.Item value="crew" style={{ flex: 1 }}>
              Crew
            </SegmentedControl.Item>
            <SegmentedControl.Item value="equipment" style={{ flex: 1 }}>
              Equipment
            </SegmentedControl.Item>
            <SegmentedControl.Item value="transport" style={{ flex: 1 }}>
              Transport
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        </Box>
      ) : (
        <AnimatedTabsList mb="3">
          <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
          <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
          <Tabs.Trigger value="transport">Transport</Tabs.Trigger>
        </AnimatedTabsList>
      )}

      <Tabs.Content value="equipment">
        <EquipmentTab jobId={jobId} />
      </Tabs.Content>

      <Tabs.Content value="crew">
        {companyId && <CrewTab jobId={jobId} companyId={companyId} />}
      </Tabs.Content>

      <Tabs.Content value="transport">
        <TransportTab jobId={jobId} />
      </Tabs.Content>
    </Tabs.Root>
  )
}
