import type { CrewPerson, PendingInvite } from '../api/queries'

export type CrewIndexTableRow = {
  kind: 'employee' | 'freelancer' | 'invite' | 'owner'
  id: string
  title: string
  subtitle?: string
  role?: 'owner' | 'employee' | 'freelancer' | 'super_user'
  email: string
}

export const CREW_KIND_ORDER: Record<CrewIndexTableRow['kind'], number> = {
  invite: 0,
  owner: 1,
  employee: 2,
  freelancer: 3,
}

type BuildCrewIndexRowsInput = {
  employees: Array<CrewPerson>
  freelancers: Array<CrewPerson>
  owners: Array<CrewPerson>
  invites: Array<PendingInvite>
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
  /** When true, owners are listed after employees/freelancers (crew page order). */
  ownersFirst?: boolean
}

export function buildCrewIndexRows({
  employees,
  freelancers,
  owners,
  invites,
  showEmployees,
  showFreelancers,
  showMyPending,
  ownersFirst = false,
}: BuildCrewIndexRowsInput): Array<CrewIndexTableRow> {
  const rows: Array<CrewIndexTableRow> = []

  const pushOwner = (u: CrewPerson) =>
    rows.push({
      kind: 'owner',
      id: u.user_id,
      title: u.display_name ?? u.email,
      subtitle: `${u.email} · owner`,
      email: u.email,
    })

  const pushEmployee = (u: CrewPerson) =>
    rows.push({
      kind: 'employee',
      id: u.user_id,
      title: u.display_name ?? u.email,
      subtitle: `${u.email} · employee`,
      email: u.email,
    })

  const pushFreelancer = (u: CrewPerson) =>
    rows.push({
      kind: 'freelancer',
      id: u.user_id,
      title: u.display_name ?? u.email,
      subtitle: `${u.email} · freelancer`,
      email: u.email,
    })

  if (ownersFirst) {
    owners.forEach(pushOwner)
  }

  if (showEmployees) employees.forEach(pushEmployee)
  if (showFreelancers) freelancers.forEach(pushFreelancer)

  if (!ownersFirst) {
    owners.forEach(pushOwner)
  }

  if (showMyPending) {
    invites.forEach((i) =>
      rows.push({
        kind: 'invite',
        id: `invite:${i.id}`,
        title: i.email,
        subtitle: `${i.role} · expires ${new Date(i.expires_at).toLocaleDateString()}`,
        role: i.role as CrewIndexTableRow['role'],
        email: i.email,
      }),
    )
  }

  return rows
}

export type CrewSortColumn = 'name' | 'email' | 'status'

export function compareCrewIndexRows(
  a: CrewIndexTableRow,
  b: CrewIndexTableRow,
  sortColumn: CrewSortColumn | null,
  sortDirection: 'asc' | 'desc',
): number {
  let comparison = 0

  if (sortColumn === 'name') {
    comparison = a.title.localeCompare(b.title)
  } else if (sortColumn === 'email') {
    comparison = a.email.localeCompare(b.email)
  } else if (sortColumn === 'status') {
    comparison = CREW_KIND_ORDER[a.kind] - CREW_KIND_ORDER[b.kind]
    if (comparison === 0) comparison = a.title.localeCompare(b.title)
  } else {
    comparison = CREW_KIND_ORDER[a.kind] - CREW_KIND_ORDER[b.kind]
    if (comparison === 0) comparison = a.title.localeCompare(b.title)
  }

  return sortDirection === 'asc' ? comparison : -comparison
}

export type CompanyCrewSortBy = 'name' | 'status'

export function compareCompanyCrewRows(
  a: CrewIndexTableRow,
  b: CrewIndexTableRow,
  sortBy: CompanyCrewSortBy,
  sortDir: 'asc' | 'desc',
): number {
  let cmp = 0
  if (sortBy === 'name') {
    cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  } else {
    cmp = CREW_KIND_ORDER[a.kind] - CREW_KIND_ORDER[b.kind]
    if (cmp === 0) cmp = a.title.localeCompare(b.title)
  }
  return sortDir === 'asc' ? cmp : -cmp
}
