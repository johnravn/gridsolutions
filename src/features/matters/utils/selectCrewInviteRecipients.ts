export type CrewInviteCandidate = {
  user_id: string | null
  placeholder_email?: string | null
}

/**
 * Who should receive a crew-role invite from a planned reserved_crew set.
 * `onlyUserIds` limits the send to people just added (skips other planned crew
 * and placeholder emails).
 */
export function selectCrewInviteRecipients<T extends CrewInviteCandidate>({
  crew,
  currentUserId,
  onlyUserIds,
}: {
  crew: Array<T>
  currentUserId: string
  onlyUserIds?: Array<string>
}): {
  userIds: Array<string>
  placeholderRows: Array<T>
} {
  const only = onlyUserIds?.length ? new Set(onlyUserIds) : null

  const userIds = crew
    .map((row) => row.user_id)
    .filter((id): id is string => !!id && id !== currentUserId)
    .filter((id) => !only || only.has(id))

  const placeholderRows = only
    ? []
    : crew.filter(
        (row) =>
          !row.user_id &&
          typeof row.placeholder_email === 'string' &&
          row.placeholder_email.trim().length > 0,
      )

  return { userIds, placeholderRows }
}
