import * as React from 'react'
import { Tabs } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
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
  const [activeSubTab, setActiveSubTab] = React.useState<string>(
    initialSubTab || 'equipment',
  )

  return (
    <Tabs.Root value={activeSubTab} onValueChange={setActiveSubTab}>
      <Tabs.List mb="3">
        <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
        <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
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
