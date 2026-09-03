import { supabase } from '@shared/api/supabase'

export type PersonalCalendarEvent = {
  id: string
  company_id: string
  user_id: string
  title: string
  start_at: string
  end_at: string
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  'id, company_id, user_id, title, start_at, end_at, created_at, updated_at'

export async function listPersonalCalendarEvents(params: {
  companyId: string
  fromIso: string
  toIso: string
  userId?: string
}): Promise<Array<PersonalCalendarEvent>> {
  let q = supabase
    .from('personal_calendar_events')
    .select(SELECT_COLS)
    .eq('company_id', params.companyId)
    .lt('start_at', params.toIso)
    .gt('end_at', params.fromIso)
    .order('start_at', { ascending: true })

  if (params.userId) q = q.eq('user_id', params.userId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Array<PersonalCalendarEvent>
}

export async function createPersonalCalendarEvent(params: {
  companyId: string
  userId: string
  title: string
  startAt: string
  endAt: string
}): Promise<PersonalCalendarEvent> {
  const { data, error } = await supabase
    .from('personal_calendar_events')
    .insert({
      company_id: params.companyId,
      user_id: params.userId,
      title: params.title.trim(),
      start_at: params.startAt,
      end_at: params.endAt,
    })
    .select(SELECT_COLS)
    .single()

  if (error) throw error
  return data as PersonalCalendarEvent
}

export async function updatePersonalCalendarEvent(params: {
  id: string
  title: string
  startAt: string
  endAt: string
}): Promise<PersonalCalendarEvent> {
  const { data, error } = await supabase
    .from('personal_calendar_events')
    .update({
      title: params.title.trim(),
      start_at: params.startAt,
      end_at: params.endAt,
    })
    .eq('id', params.id)
    .select(SELECT_COLS)
    .single()

  if (error) throw error
  return data as PersonalCalendarEvent
}

export async function deletePersonalCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('personal_calendar_events')
    .delete()
    .eq('id', id)

  if (error) throw error
}
