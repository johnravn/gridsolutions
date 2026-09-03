export type CrewFollowRole = 'owner' | 'employee' | 'freelancer' | 'super_user'

/** Whether a subscriber may add a crew_user calendar for the target member. */
export function canFollowCrewUser(params: {
  subscriberUserId: string
  subscriberRole: CrewFollowRole | null
  targetUserId: string
  targetRole: CrewFollowRole | null
}): boolean {
  const { subscriberUserId, subscriberRole, targetUserId, targetRole } = params
  if (!subscriberRole || !targetRole) return false
  if (subscriberUserId === targetUserId) return false
  if (subscriberRole === 'freelancer') return false
  if (subscriberRole === 'employee' && targetRole === 'owner') return false
  return true
}

export function crewDisplayName(person: {
  display_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}): string {
  const fromParts = [person.first_name, person.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  return (
    person.display_name?.trim() || fromParts || person.email?.trim() || 'Crew'
  )
}
