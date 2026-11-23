import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Select } from '@radix-ui/themes'
import { reportProjectLeadsQuery } from '../api/queries'

/** Sentinel for “no lead filter” (Select needs a non-empty value). */
export const PROJECT_LEAD_FILTER_ALL = 'all'

export function ProjectLeadControl({
  companyId,
  value,
  onChange,
}: {
  companyId: string
  value: string
  onChange: (next: string) => void
}) {
  const leadsQuery = useQuery({
    ...reportProjectLeadsQuery({ companyId }),
    enabled: !!companyId,
  })

  const options = React.useMemo(() => {
    const leads = [...(leadsQuery.data ?? [])]
    leads.sort((a, b) => {
      const aLabel = (a.display_name || a.email || '').toLocaleLowerCase()
      const bLabel = (b.display_name || b.email || '').toLocaleLowerCase()
      return aLabel.localeCompare(bLabel)
    })
    return leads
  }, [leadsQuery.data])

  return (
    <Select.Root
      size="2"
      value={value}
      onValueChange={onChange}
      disabled={leadsQuery.isLoading}
    >
      <Select.Trigger
        variant="soft"
        placeholder="Project lead"
        aria-label="Project lead"
        style={{ minWidth: 140 }}
      />
      <Select.Content position="popper" sideOffset={4}>
        <Select.Item value={PROJECT_LEAD_FILTER_ALL}>All</Select.Item>
        {options.map((lead) => (
          <Select.Item key={lead.user_id} value={lead.user_id}>
            {lead.display_name || lead.email}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}
