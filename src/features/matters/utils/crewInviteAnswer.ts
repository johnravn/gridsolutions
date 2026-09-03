export type CrewInviteAnswerStatus = 'accepted' | 'declined'
export type MatterOutcomeStatus = CrewInviteAnswerStatus
export type MatterOutcomeKind = 'crew_invite' | 'offer'

export type CrewInviteAnswerMeta = {
  source_crew_invite_matter_id: string
  answered_by_user_id: string
  recipient_status: CrewInviteAnswerStatus
}

export type MatterOutcome = {
  kind: MatterOutcomeKind
  status: MatterOutcomeStatus
  answeredByUserId: string | null
  answeredByName: string | null
}

function isAnswerStatus(value: unknown): value is CrewInviteAnswerStatus {
  return value === 'accepted' || value === 'declined'
}

function asRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }
  return metadata as Record<string, unknown>
}

function trimName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name.length > 0 ? name : null
}

/** Metadata on `update` matters created when a crew member accepts or declines. */
export function parseCrewInviteAnswerMeta(
  metadata: unknown,
): CrewInviteAnswerMeta | null {
  const record = asRecord(metadata)
  if (!record) return null
  const sourceId = record.source_crew_invite_matter_id
  const answeredBy = record.answered_by_user_id
  const status = record.recipient_status
  if (
    typeof sourceId !== 'string' ||
    !sourceId.trim() ||
    typeof answeredBy !== 'string' ||
    !answeredBy.trim() ||
    !isAnswerStatus(status)
  ) {
    return null
  }
  return {
    source_crew_invite_matter_id: sourceId,
    answered_by_user_id: answeredBy,
    recipient_status: status,
  }
}

/**
 * Accepted/declined outcome for crew-invite answers and offer answers.
 * Offer rejections are shown as declined.
 */
export function parseMatterOutcome(metadata: unknown): MatterOutcome | null {
  const record = asRecord(metadata)
  if (!record) return null

  const crew = parseCrewInviteAnswerMeta(record)
  if (crew) {
    return {
      kind: 'crew_invite',
      status: crew.recipient_status,
      answeredByUserId: crew.answered_by_user_id,
      answeredByName: null,
    }
  }

  if (typeof record.source_crew_invite_matter_id === 'string') {
    return null
  }

  const offerId = trimName(record.offer_id)
  const acceptedName = trimName(record.accepted_by_name)
  const rejectedName = trimName(record.rejected_by_name)
  const isOfferUpdate =
    offerId != null || record.accepted_at != null || record.rejected_at != null
  if (!isOfferUpdate) return null

  const hasRejected =
    record.rejected_at != null ||
    rejectedName != null ||
    record.recipient_status === 'declined'
  const hasAccepted =
    record.accepted_at != null ||
    acceptedName != null ||
    record.recipient_status === 'accepted'

  if (hasRejected) {
    return {
      kind: 'offer',
      status: 'declined',
      answeredByUserId: null,
      answeredByName: rejectedName || 'Customer',
    }
  }

  if (!hasAccepted) return null

  return {
    kind: 'offer',
    status: 'accepted',
    answeredByUserId: null,
    answeredByName: acceptedName || 'Customer',
  }
}

export function crewInviteAnswerUserIds(
  matters: Array<{ metadata?: unknown }>,
): Array<string> {
  const ids = new Set<string>()
  for (const matter of matters) {
    const answer = parseCrewInviteAnswerMeta(matter.metadata)
    if (answer) ids.add(answer.answered_by_user_id)
  }
  return [...ids]
}
