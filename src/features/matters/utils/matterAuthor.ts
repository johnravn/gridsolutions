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
      userId: string
      email: string
    }

/** Identity to show on a matter card / "Created by" line. */
export function resolveMatterCardAuthor(matter: {
  created_as_company?: boolean | null
  created_by?: MatterAuthorPerson | null
  company?: { id: string; name: string } | null
}): MatterCardAuthor | null {
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
    const name =
      matter.created_by.display_name?.trim() || matter.created_by.email
    if (!name) return null
    return {
      kind: 'person',
      name,
      avatarPath: matter.created_by.avatar_url,
      userId: matter.created_by.user_id,
      email: matter.created_by.email,
    }
  }

  return null
}
