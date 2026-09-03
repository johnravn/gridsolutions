import { parseMatterOutcome } from './crewInviteAnswer'

export type MatterAuthorPerson = {
  user_id: string
  display_name: string | null
  email: string
  avatar_url: string | null
}

export type MatterCardAuthor =
  | {
      kind: 'company'
      name: string
      avatarPath: null
      userId: null
      email: string
    }
  | {
      kind: 'person'
      name: string
      avatarPath: string | null
      userId: string | null
      email: string
    }

function personAuthor(person: MatterAuthorPerson): MatterCardAuthor | null {
  const name = person.display_name?.trim() || person.email
  if (!name) return null
  return {
    kind: 'person',
    name,
    avatarPath: person.avatar_url,
    userId: person.user_id,
    email: person.email,
  }
}

/** Identity to show on a matter card / "Created by" line. */
export function resolveMatterCardAuthor(matter: {
  created_as_company?: boolean | null
  created_by?: MatterAuthorPerson | null
  answered_by?: MatterAuthorPerson | null
  metadata?: unknown
  company?: { id: string; name: string } | null
}): MatterCardAuthor | null {
  const outcome = parseMatterOutcome(matter.metadata)
  if (outcome?.kind === 'crew_invite' && matter.answered_by) {
    const answering = personAuthor(matter.answered_by)
    if (answering) return answering
  }
  if (outcome?.kind === 'offer' && outcome.answeredByName) {
    return {
      kind: 'person',
      name: outcome.answeredByName,
      avatarPath: null,
      userId: null,
      email: '',
    }
  }

  if (matter.created_as_company && matter.company?.name.trim()) {
    return {
      kind: 'company',
      name: matter.company.name.trim(),
      avatarPath: null,
      userId: null,
      email: '',
    }
  }

  if (matter.created_by) {
    return personAuthor(matter.created_by)
  }

  return null
}
