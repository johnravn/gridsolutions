/**
 * Typed accessors for matter.metadata fields.
 * Prefer these over casting metadata to `any` / ad-hoc shapes.
 */

export function asMetadataRecord(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }
  return metadata as Record<string, unknown>
}

/** Invitation note stored on crew_invite matters (preferred over first message). */
export function parseInvitationMessage(metadata: unknown): string | null {
  const record = asMetadataRecord(metadata)
  const value = record?.invitation_message
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Latest-feed activity id linked when an announcement was posted. */
export function parseActivityId(metadata: unknown): string | null {
  const record = asMetadataRecord(metadata)
  const value = record?.activity_id
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
