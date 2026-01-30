export type MatterType =
  | 'crew_invite'
  | 'vote'
  | 'announcement'
  | 'chat'
  | 'update'
export type MatterRecipientStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'responded'
  | 'declined'
  | 'accepted'

export type Matter = {
  id: string
  company_id: string
  created_by_user_id: string
  matter_type: MatterType
  title: string
  content: string | null
  job_id: string | null
  time_period_id: string | null
  is_anonymous: boolean
  allow_custom_responses: boolean
  created_as_company: boolean
  created_at: string
  updated_at: string
  metadata?: Record<string, any> | null
  created_by?: {
    user_id: string
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
  company?: {
    id: string
    name: string
  } | null
  job?: {
    id: string
    title: string
    project_lead?: {
      user_id: string
      display_name: string | null
      email: string
      avatar_url: string | null
    } | null
  } | null
  time_period?: {
    id: string
    title: string | null
  } | null
  recipient_count?: number
  response_count?: number
  my_response?: MatterResponse | null
  is_unread?: boolean // Whether this matter is unread for the current user
}

export type MatterRecipient = {
  id: string
  matter_id: string
  user_id: string
  status: MatterRecipientStatus
  viewed_at: string | null
  responded_at: string | null
  created_at: string
  user?: {
    user_id: string
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
  response?: {
    id: string
    response: string
    created_at: string
    updated_at: string
  } | null
}

export type MatterResponse = {
  id: string
  matter_id: string
  user_id: string
  response: string
  created_at: string
  updated_at: string
  user?: {
    user_id: string
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export type MatterMessage = {
  id: string
  matter_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  user?: {
    user_id: string
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export type CreateMatterInput = {
  company_id: string
  matter_type: MatterType
  title: string
  content?: string | null
  job_id?: string | null
  time_period_id?: string | null
  recipient_user_ids: Array<string>
  is_anonymous?: boolean
  allow_custom_responses?: boolean
  created_as_company?: boolean
  files?: Array<File>
}

export type MatterFile = {
  id: string
  matter_id: string
  filename: string
  path: string
  mime_type: string | null
  size_bytes: number | null
  title: string | null
  note: string | null
  uploaded_by_user_id: string
  created_at: string
  uploaded_by?: {
    user_id: string
    display_name: string | null
    email: string
  } | null
}

export type CreateVoteInput = {
  company_id: string
  title: string
  content?: string | null
  recipient_user_ids: Array<string>
  is_anonymous?: boolean
  allow_custom_responses?: boolean
  files?: Array<File>
}
