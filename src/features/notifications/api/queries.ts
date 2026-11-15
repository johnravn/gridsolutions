import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { sendNotificationEmailNow } from '@shared/email/supabaseEdgeEmail'

export type NotificationType =
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_revision_requested'
  | 'crew_invite'
  | 'matter_reply'
  | 'matter_mention'
  | 'matter_update'
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
  email_matter_announcements?: boolean
  email_matter_updates?: boolean
  email_matter_invites?: boolean
  created_at: string
  updated_at: string
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

/** Mark notification as read by entity (e.g. when user views a matter). */
export async function markNotificationReadByEntity(
  userId: string,
  entityType: string,
  entityId: string,
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

/** Clear notification read state by entity (e.g. when a matter is marked unread). */
export async function markNotificationUnreadByEntity(
  userId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: null })
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
  if (error) throw error
}

export async function markNotificationsReadByMatterIds(
  userId: string,
  matterIds: Array<string>,
): Promise<void> {
  if (matterIds.length === 0) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('entity_type', 'matter')
    .in('entity_id', matterIds)
    .is('read_at', null)
  if (error) throw error
}

export async function markNotificationsUnreadByMatterIds(
  userId: string,
  matterIds: Array<string>,
): Promise<void> {
  if (matterIds.length === 0) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: null })
    .eq('user_id', userId)
    .eq('entity_type', 'matter')
    .in('entity_id', matterIds)
  if (error) throw error
}

export async function upsertNotificationPreferences(payload: {
  user_id: string
  company_id: string
  email_offer_updates?: boolean
  email_crew_invites?: boolean
  email_matter_replies?: boolean
  email_reminders?: boolean
  email_announcements?: boolean
  email_matter_announcements?: boolean
  email_matter_updates?: boolean
  email_matter_invites?: boolean
}): Promise<void> {
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: payload.user_id,
      company_id: payload.company_id,
      email_offer_updates: payload.email_offer_updates ?? true,
      email_crew_invites: payload.email_crew_invites ?? true,
      email_matter_replies: payload.email_matter_replies ?? true,
      email_reminders: payload.email_reminders ?? true,
      email_announcements: payload.email_announcements ?? true,
      email_matter_announcements: payload.email_matter_announcements ?? true,
      email_matter_updates: payload.email_matter_updates ?? true,
      email_matter_invites: payload.email_matter_invites ?? true,
    },
    { onConflict: 'user_id,company_id' },
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
  /**
   * When true, edge send bypasses prefs (crew_invite, force-email announcements).
   * Client also awaits `sendNotificationEmailNow` so delivery does not depend solely
   * on vault/pg_net (DB trigger remains a backup; rare duplicates possible).
   */
  email_force_send?: boolean
}

export async function createNotification(
  payload: CreateNotificationPayload,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      company_id: payload.company_id,
      user_id: payload.user_id,
      created_by_user_id: user.id,
      type: payload.type,
      title: payload.title,
      body_text: payload.body_text ?? null,
      action_url: payload.action_url ?? null,
      entity_type: payload.entity_type ?? null,
      entity_id: payload.entity_id ?? null,
      email_force_send: payload.email_force_send ?? false,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/**
 * Create a notification. Preferential email path for `forceEmail`:
 * client JWT → `send-notification-email` (same as Super). DB trigger / cron remain
 * backup when vault `cron_secret` works; `email_sent_at` usually dedupes the second call.
 */
export async function createNotificationAndSendEmail(
  payload: CreateNotificationPayload,
  options?: { forceEmail?: boolean },
): Promise<string> {
  const forceEmail = payload.email_force_send ?? options?.forceEmail ?? false
  const notificationId = await createNotification({
    ...payload,
    email_force_send: forceEmail,
  })

  if (forceEmail) {
    const sent = await sendNotificationEmailNow({
      notificationId,
      forceEmail: true,
    })
    if (!sent.ok) {
      throw new Error(
        sent.failure.details
          ? `${sent.failure.message}: ${sent.failure.details}`
          : sent.failure.message,
      )
    }
  }

  return notificationId
}
