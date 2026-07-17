import { Tabs } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import { useAuthz } from '@shared/auth/useAuthz'
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

      <AnimatedTabsList mb="3">
        <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
        <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
        <Tabs.Trigger value="transport">Transport</Tabs.Trigger>
      </AnimatedTabsList>

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
