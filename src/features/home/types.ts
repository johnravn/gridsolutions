// Types for home dashboard sections

import type { JobListRow } from '@features/jobs/types'

export type DaysFilter = '7' | '14' | '30' | 'all'

export type MyJobRole = 'crew' | 'project_lead' | 'both' | null

export type UpcomingJob = {
  id: string
  title: string
  status: string
  start_at: string | null
  end_at: string | null
  my_job_role?: MyJobRole
  customer?: {
    id: string
    name: string | null
  } | null
  project_lead?: {
    user_id: string
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export type WeekJobWithRole = JobListRow & {
  my_job_role: MyJobRole
}

export type MatterType =
  | 'crew_invite'
  | 'vote'
  | 'announcement'
  | 'chat'
  | 'update'

export type HomeMatter = {
  id: string
  title: string
  matter_type: MatterType
  created_at: string
  is_unread?: boolean
  created_by?: {
    user_id: string
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export type HomeJobReadyToInvoice = {
  id: string
  title: string
  jobnr: number | null
  start_at: string | null
  end_at: string | null
  customer?: {
    id: string
    name: string | null
  } | null
}
