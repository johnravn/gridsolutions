export type CrewInviteResponseKind =
  | 'accepted'
  | 'declined'
  | 'filled'
  | 'other'
  | 'none'

export const ROLE_FILLED_MESSAGE = 'This role is already filled'
export const ROLE_FILLED_DETAIL =
  'The available spots were taken by others who accepted first.'

export function crewInviteResponseKind(
  response: string | null | undefined,
): CrewInviteResponseKind {
  if (!response) return 'none'
  const value = response.trim().toLowerCase()
  if (value === 'approved' || value === 'accepted') return 'accepted'
  if (value === 'rejected' || value === 'declined') return 'declined'
  if (value === 'role_filled' || value === 'taken') return 'filled'
  return 'other'
}
