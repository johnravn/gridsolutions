import type { MyJobRole } from '../types'

export function resolveMyJobRole({
  userId,
  projectLeadUserId,
  isCrew,
}: {
  userId: string | null
  projectLeadUserId: string | null | undefined
  isCrew: boolean
}): MyJobRole {
  const isProjectLead = !!userId && projectLeadUserId === userId
  if (isProjectLead) return isCrew ? 'both' : 'project_lead'
  if (isCrew) return 'crew'
  return null
}

export function myJobRoleBadge(role: MyJobRole): {
  label: string
  color: 'blue' | 'orange' | 'purple'
} | null {
  if (role === 'crew') return { label: 'Crew', color: 'orange' }
  if (role === 'project_lead') return { label: 'Lead', color: 'blue' }
  if (role === 'both') return { label: 'Lead + Crew', color: 'purple' }
  return null
}
