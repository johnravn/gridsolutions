import { useQuery } from '@tanstack/react-query'
import { crewIndexQuery, pendingInvitesQuery } from '../api/queries'
import type { CrewPerson, PendingInvite } from '../api/queries'

export type CrewIndexBundle = {
  employees: Array<CrewPerson>
  freelancers: Array<CrewPerson>
  owners: Array<CrewPerson>
  invites: Array<PendingInvite>
  isLoading: boolean
}

/** Single source for crew index + pending-invite queries (page skeleton + table). */
export function useCrewIndexBundle({
  companyId,
  showEmployees,
  showFreelancers,
  showMyPending,
}: {
  companyId: string | null | undefined
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
}): CrewIndexBundle {
  const enabled = !!companyId

  const { data: employees = [], isLoading: empLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId ?? '', kind: 'employee' }),
    enabled: enabled && showEmployees,
  })

  const { data: freelancers = [], isLoading: frLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId ?? '', kind: 'freelancer' }),
    enabled: enabled && showFreelancers,
  })

  const { data: owners = [], isLoading: owLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId ?? '', kind: 'owner' }),
    enabled,
  })

  const { data: invites = [], isLoading: invLoading } = useQuery({
    ...pendingInvitesQuery({ companyId: companyId ?? '' }),
    enabled: enabled && showMyPending,
  })

  return {
    employees,
    freelancers,
    owners,
    invites,
    isLoading: empLoading || frLoading || owLoading || invLoading,
  }
}
