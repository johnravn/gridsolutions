import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export type NotificationType =
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_revision_requested'
  | 'crew_invite'
  | 'matter_reply'
  | 'matter_mention'
  | 'reminder'
  | 'announcement'
  | 'other'

export type Notification = {
  id: string
  company_id: string
  user_id: string
  type: NotificationType
  title: string
  body_text: string | null
  action_url: string | null
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  email_sent_at: string | null
  created_at: string
}

export type NotificationPreferences = {
  user_id: string
  company_id: string
  email_offer_updates: boolean
  email_crew_invites: boolean
  email_matter_replies: boolean
  email_reminders: boolean
  email_announcements: boolean
  created_at: string
  updated_at: string
}

export function notificationsQuery({
  userId,
  companyId,
  unreadOnly = false,
  limit = 50,
}: {
  userId: string
  companyId: string | null
  unreadOnly?: boolean
  limit?: number
}) {
  return queryOptions<Array<Notification>>({
    queryKey: ['notifications', userId, companyId ?? 'all', unreadOnly, limit],
    queryFn: async () => {
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (companyId) {
        q = q.eq('company_id', companyId)
      }
      if (unreadOnly) {
        q = q.is('read_at', null)
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Array<Notification>
    },
    enabled: !!userId,
  })
}

export function unreadNotificationsCountQuery({
  userId,
  companyId,
}: {
  userId: string
  companyId: string | null
}) {
  return queryOptions<number>({
    queryKey: ['notifications', 'unread-count', userId, companyId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
      if (companyId) {
        q = q.eq('company_id', companyId)
      }
      const { count, error } = await q
      if (error) throw error
      return count ?? 0
    },
    enabled: !!userId,
  })
}

export function notificationPreferencesQuery({
  userId,
  companyId,
}: {
  userId: string
  companyId: string
}) {
  return queryOptions<NotificationPreferences | null>({
    queryKey: ['notification-preferences', userId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) throw error
      return data as NotificationPreferences | null
    },
    enabled: !!userId && !!companyId,
  })
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  if (error) throw error
}

/** Mark notification as read by entity (e.g. when user views a matter). */
export async function markNotificationReadByEntity(
  userId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .is('read_at', null)
  if (error) throw error
}

export async function markAllNotificationsRead(
  userId: string,
  companyId: string | null
): Promise<void> {
  let q = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (companyId) {
    q = q.eq('company_id', companyId)
  }
  const { error } = await q
  if (error) throw error
}

/** Get entity_ids of unread notifications with entity_type='matter' (for syncing matter_recipients.viewed_at). */
export async function getUnreadMatterEntityIds(
  userId: string,
  companyId: string | null
): Promise<string[]> {
  let q = supabase
    .from('notifications')
    .select('entity_id')
    .eq('user_id', userId)
    .eq('entity_type', 'matter')
    .not('entity_id', 'is', null)
    .is('read_at', null)
  if (companyId) {
    q = q.eq('company_id', companyId)
  }
  const { data, error } = await q
  if (error) throw error
  const ids = [...new Set((data ?? []).map((r) => r.entity_id).filter(Boolean))]
  return ids as string[]
}

export async function upsertNotificationPreferences(
  payload: {
    user_id: string
    company_id: string
    email_offer_updates?: boolean
    email_crew_invites?: boolean
    email_matter_replies?: boolean
    email_reminders?: boolean
    email_announcements?: boolean
  }
): Promise<void> {
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: payload.user_id,
      company_id: payload.company_id,
      email_offer_updates: payload.email_offer_updates ?? true,
      email_crew_invites: payload.email_crew_invites ?? true,
      email_matter_replies: payload.email_matter_replies ?? true,
      email_reminders: payload.email_reminders ?? true,
      email_announcements: payload.email_announcements ?? true,
    },
    { onConflict: 'user_id,company_id' }
  )
  if (error) throw error
}

export type CreateNotificationPayload = {
  company_id: string
  user_id: string
  type: NotificationType
  title: string
  body_text?: string | null
  action_url?: string | null
  entity_type?: string | null
  entity_id?: string | null
}

export async function createNotification(
  payload: CreateNotificationPayload
): Promise<string> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      company_id: payload.company_id,
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      body_text: payload.body_text ?? null,
      action_url: payload.action_url ?? null,
      entity_type: payload.entity_type ?? null,
      entity_id: payload.entity_id ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** Create a notification and trigger the Edge Function to send email (if preferences allow). */
export async function createNotificationAndSendEmail(
  payload: CreateNotificationPayload,
  options?: { forceEmail?: boolean }
): Promise<string> {
  const id = await createNotification(payload)
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2d91110b-5d7c-457b-b926-3a30c5abf539',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'63b6c4'},body:JSON.stringify({sessionId:'63b6c4',location:'queries.ts:createNotificationAndSendEmail',message:'createNotificationAndSendEmail called',data:{notificationId:id,type:payload.type,userId:payload.user_id,forceEmail:options?.forceEmail},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  try {
    const result = await supabase.functions.invoke('send-notification-email', {
      body: {
        notification_id: id,
        force_email: options?.forceEmail ?? false,
      },
    })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2d91110b-5d7c-457b-b926-3a30c5abf539',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'63b6c4'},body:JSON.stringify({sessionId:'63b6c4',location:'queries.ts:invoke result',message:'send-notification-email invoke result',data:{hasError:!!result.error,errorMsg:result.error?.message,data:result.data},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2d91110b-5d7c-457b-b926-3a30c5abf539',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'63b6c4'},body:JSON.stringify({sessionId:'63b6c4',location:'queries.ts:invoke catch',message:'send-notification-email invoke threw',data:{error:String(e)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    // Non-blocking: email failure should not fail the operation
  }
  return id
}
