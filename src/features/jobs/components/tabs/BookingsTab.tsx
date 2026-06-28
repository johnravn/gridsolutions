import * as React from 'react'
import { Tabs } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { jobDetailQuery } from '@features/jobs/api/queries'
import { JobBookingConflictsBanner } from '@features/conflicts/components/JobBookingConflictsBanner'
import EquipmentTab from './EquipmentTab'
import CrewTab from './CrewTab'
import TransportTab from './TransportTab'

export default function BookingsTab({
  jobId,
  initialSubTab,
}: {
  jobId: string
  initialSubTab?: string
}) {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const [activeSubTab, setActiveSubTab] = React.useState<string>(
    initialSubTab || 'crew',
  )

  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
  })

  const isProjectLead = !!userId && job?.project_lead?.user_id === userId
  const showConflictsBanner = companyRole !== 'freelancer'

  return (
    <Tabs.Root value={activeSubTab} onValueChange={setActiveSubTab}>
      {showConflictsBanner && (
        <JobBookingConflictsBanner
          jobId={jobId}
          isProjectLead={isProjectLead}
          onNavigateSubTab={setActiveSubTab}
        />
      )}

      <Tabs.List mb="3">
        <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
        <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
        <Tabs.Trigger value="transport">Transport</Tabs.Trigger>
      </Tabs.List>

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
