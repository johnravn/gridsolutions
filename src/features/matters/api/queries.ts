import { supabase } from '@shared/api/supabase'
import type {
  CreateMatterInput,
  CreateVoteInput,
  Matter,
  MatterMessage,
  MatterRecipient,
  MatterResponse,
} from '../types'

// Fetch matters from all companies the user is a member of
export function mattersIndexQueryAll() {
  return {
    queryKey: ['matters', 'index', 'all'],
    queryFn: async (): Promise<Array<Matter>> => {
      // Get current user ID
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return []

      // Get all companies the user is a member of
      // Check if user is a superuser
      const { data: profile } = await supabase
        .from('profiles')
        .select('superuser')
        .eq('user_id', user.id)
        .maybeSingle()

      const isSuperuser = profile?.superuser ?? false

      let companyIds: Array<string> = []
      if (isSuperuser) {
        // Superusers can access all companies
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('id')
        companyIds = (allCompanies || []).map((c) => c.id)
      } else {
        // Regular users only see companies they're members of
        const { data: memberships } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
        companyIds = (memberships || []).map((m) => m.company_id)
      }

      if (companyIds.length === 0) return []

      // Get all matters where user is a recipient (with read status)
      const { data: recipientMatters, error: recError } = await supabase
        .from('matter_recipients' as any)
        .select('matter_id, viewed_at')
        .eq('user_id', user.id)

      if (recError) throw recError

      // Get all matter IDs where user is recipient or creator
      const recipientMatterIds = new Set<string>(
        (recipientMatters || []).map((r) => r.matter_id as string),
      )

      // Track which matters are unread
      const unreadMatterIds = new Set<string>(
        (recipientMatters || [])
          .filter((r) => !r.viewed_at)
          .map((r) => r.matter_id as string),
      )

      // Now fetch matters from all companies the user is a member of
      // User must be either creator OR recipient
      const q = supabase
        .from('matters' as any)
        .select(
          `
          id,
          company_id,
          created_by_user_id,
          matter_type,
          title,
          content,
          job_id,
          time_period_id,
          is_anonymous,
          allow_custom_responses,
          created_as_company,
          created_at,
          updated_at,
          metadata,
          created_by:created_by_user_id ( user_id, display_name, email, avatar_url ),
          company:company_id ( id, name ),
          job:job_id ( id, title, project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url ) ),
          time_period:time_period_id ( id, title )
        `,
        )
        .in('company_id', companyIds)
        .order('created_at', { ascending: false })

      const { data: allMatters, error } = await q
      if (error) throw error

      // Filter to only matters where user is creator or recipient
      // For crew_invite matters, only show if user is a recipient (not if they're the creator)
      const filteredMatters = (allMatters || []).filter((m) => {
        // For crew_invite, only show if user is a recipient
        if (m.matter_type === 'crew_invite') {
          return recipientMatterIds.has(m.id)
        }
        // For other matter types, show if user is creator or recipient
        return m.created_by_user_id === user.id || recipientMatterIds.has(m.id)
      })

      if (filteredMatters.length === 0) return []

      const matterIds = filteredMatters.map((m) => m.id)

      // Get recipient and response counts for these matters
      const [recipientsData, responsesData] = await Promise.all([
        supabase
          .from('matter_recipients' as any)
          .select('matter_id')
          .in('matter_id', matterIds),
        supabase
          .from('matter_responses' as any)
          .select('matter_id')
          .in('matter_id', matterIds),
      ])

      if (recipientsData.error) throw recipientsData.error
      if (responsesData.error) throw responsesData.error

      const recipientCounts = new Map<string, number>()
      const responseCounts = new Map<string, number>()

      for (const r of recipientsData.data || []) {
        recipientCounts.set(
          r.matter_id as string,
          (recipientCounts.get(r.matter_id as string) || 0) + 1,
        )
      }

      for (const r of responsesData.data || []) {
        responseCounts.set(
          r.matter_id as string,
          (responseCounts.get(r.matter_id as string) || 0) + 1,
        )
      }

      // Get my responses for these matters
      const { data: myResponsesData } = await supabase
        .from('matter_responses' as any)
        .select('matter_id, id, response, created_at, updated_at')
        .eq('user_id', user.id)
        .in('matter_id', matterIds)

      const myResponseMap = new Map<string, any>()
      if (myResponsesData) {
        for (const r of myResponsesData) {
          myResponseMap.set(r.matter_id as string, {
            id: r.id,
            matter_id: r.matter_id,
            user_id: user.id,
            response: r.response,
            created_at: r.created_at,
            updated_at: r.updated_at,
          })
        }
      }

      return filteredMatters.map((m) => ({
        ...m,
        recipient_count: recipientCounts.get(m.id) || 0,
        response_count: responseCounts.get(m.id) || 0,
        my_response: myResponseMap.get(m.id) || null,
        // Matter is unread if user is a recipient and hasn't viewed it
        // Matters created by the user are considered "read" unless they were created_as_company
        // (company-created matters should still be treated as unread if delivered to the inbox)
        is_unread:
          unreadMatterIds.has(m.id) &&
          (m.created_by_user_id !== user.id || m.created_as_company),
      })) as Array<Matter>
    },
  }
}

// Legacy function - kept for backward compatibility, but uses single company
export function mattersIndexQuery(companyId: string) {
  return {
    queryKey: ['matters', 'index', companyId],
    queryFn: async (): Promise<Array<Matter>> => {
      // Get current user ID
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return []

      // Get all matters where user is a recipient (with read status)
      const { data: recipientMatters, error: recError } = await supabase
        .from('matter_recipients' as any)
        .select('matter_id, viewed_at')
        .eq('user_id', user.id)

      if (recError) throw recError

      // Get all matter IDs where user is recipient or creator
      const recipientMatterIds = new Set<string>(
        (recipientMatters || []).map((r) => r.matter_id as string),
      )

      // Track which matters are unread
      const unreadMatterIds = new Set<string>(
        (recipientMatters || [])
          .filter((r) => !r.viewed_at)
          .map((r) => r.matter_id as string),
      )

      // Now fetch matters that:
      // 1. Belong to the company
      // 2. User is either creator OR recipient
      const q = supabase
        .from('matters' as any)
        .select(
          `
          id,
          company_id,
          created_by_user_id,
          matter_type,
          title,
          content,
          job_id,
          time_period_id,
          is_anonymous,
          allow_custom_responses,
          created_as_company,
          created_at,
          updated_at,
          metadata,
          created_by:created_by_user_id ( user_id, display_name, email, avatar_url ),
          company:company_id ( id, name ),
          job:job_id ( id, title, project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url ) ),
          time_period:time_period_id ( id, title )
        `,
        )
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      const { data: allMatters, error } = await q
      if (error) throw error

      // Filter to only matters where user is creator or recipient
      // For crew_invite matters, only show if user is a recipient (not if they're the creator)
      const filteredMatters = (allMatters || []).filter((m) => {
        // For crew_invite, only show if user is a recipient
        if (m.matter_type === 'crew_invite') {
          return recipientMatterIds.has(m.id)
        }
        // For other matter types, show if user is creator or recipient
        return m.created_by_user_id === user.id || recipientMatterIds.has(m.id)
      })

      if (filteredMatters.length === 0) return []

      const matterIds = filteredMatters.map((m) => m.id)

      // Get recipient and response counts for these matters
      const [recipientsData, responsesData] = await Promise.all([
        supabase
          .from('matter_recipients' as any)
          .select('matter_id')
          .in('matter_id', matterIds),
        supabase
          .from('matter_responses' as any)
          .select('matter_id')
          .in('matter_id', matterIds),
      ])

      if (recipientsData.error) throw recipientsData.error
      if (responsesData.error) throw responsesData.error

      const recipientCounts = new Map<string, number>()
      const responseCounts = new Map<string, number>()

      for (const r of recipientsData.data || []) {
        recipientCounts.set(
          r.matter_id as string,
          (recipientCounts.get(r.matter_id as string) || 0) + 1,
        )
      }

      for (const r of responsesData.data || []) {
        responseCounts.set(
          r.matter_id as string,
          (responseCounts.get(r.matter_id as string) || 0) + 1,
        )
      }

      // Get my responses for these matters
      const { data: myResponsesData } = await supabase
        .from('matter_responses' as any)
        .select('matter_id, id, response, created_at, updated_at')
        .eq('user_id', user.id)
        .in('matter_id', matterIds)

      const myResponseMap = new Map<string, any>()
      if (myResponsesData) {
        for (const r of myResponsesData) {
          myResponseMap.set(r.matter_id as string, {
            id: r.id,
            matter_id: r.matter_id,
            user_id: user.id,
            response: r.response,
            created_at: r.created_at,
            updated_at: r.updated_at,
          })
        }
      }

      return filteredMatters.map((m) => ({
        ...m,
        recipient_count: recipientCounts.get(m.id) || 0,
        response_count: responseCounts.get(m.id) || 0,
        my_response: myResponseMap.get(m.id) || null,
        // Matter is unread if user is a recipient and hasn't viewed it
        // Matters created by the user are considered "read" unless they were created_as_company
        // (company-created matters should still be treated as unread if delivered to the inbox)
        is_unread:
          unreadMatterIds.has(m.id) &&
          (m.created_by_user_id !== user.id || m.created_as_company),
      })) as Array<Matter>
    },
  }
}

export function matterDetailQuery(matterId: string) {
  return {
    queryKey: ['matters', 'detail', matterId],
    queryFn: async (): Promise<Matter | null> => {
      const { data, error } = await supabase
        .from('matters' as any)
        .select(
          `
          id,
          company_id,
          created_by_user_id,
          matter_type,
          title,
          content,
          job_id,
          time_period_id,
          is_anonymous,
          allow_custom_responses,
          created_as_company,
          created_at,
          updated_at,
          metadata,
          created_by:created_by_user_id ( user_id, display_name, email, avatar_url ),
          company:company_id ( id, name ),
          job:job_id ( id, title, project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url ) ),
          time_period:time_period_id ( id, title )
        `,
        )
        .eq('id', matterId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      if (!data) return null

      // Get my response if logged in
      const {
        data: { user },
      } = await supabase.auth.getUser()
      let myResponse: MatterResponse | null = null

      if (user) {
        const { data: responseData } = await supabase
          .from('matter_responses' as any)
          .select(
            `
            id,
            matter_id,
            user_id,
            response,
            created_at,
            updated_at,
            user:user_id ( user_id, display_name, email, avatar_url )
          `,
          )
          .eq('matter_id', matterId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (responseData) {
          myResponse = responseData as unknown as MatterResponse
        }
      }

      return {
        ...(data as any),
        my_response: myResponse,
      } as Matter
    },
  }
}

export function matterRecipientsQuery(matterId: string) {
  return {
    queryKey: ['matters', 'recipients', matterId],
    queryFn: async (): Promise<Array<MatterRecipient>> => {
      // Fetch recipients
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('matter_recipients' as any)
        .select(
          `
          id,
          matter_id,
          user_id,
          status,
          viewed_at,
          responded_at,
          created_at,
          user:user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('matter_id', matterId)
        .order('created_at', { ascending: true })

      if (recipientsError) throw recipientsError

      // Fetch responses for this matter
      const { data: responsesData, error: responsesError } = await supabase
        .from('matter_responses' as any)
        .select('id, matter_id, user_id, response, created_at, updated_at')
        .eq('matter_id', matterId)

      if (responsesError) throw responsesError

      // Create a map of user_id -> response for quick lookup
      const responseMap = new Map<string, any>()
      if (responsesData) {
        for (const response of responsesData) {
          responseMap.set(response.user_id as string, {
            id: response.id,
            response: response.response,
            created_at: response.created_at,
            updated_at: response.updated_at,
          })
        }
      }

      // Merge responses with recipients
      const recipients = (recipientsData || []).map((r: any) => ({
        ...r,
        response: responseMap.get(r.user_id) || null,
      }))

      return recipients as unknown as Array<MatterRecipient>
    },
  }
}

export function matterResponsesQuery(matterId: string) {
  return {
    queryKey: ['matters', 'responses', matterId],
    queryFn: async (): Promise<Array<MatterResponse>> => {
      const { data, error } = await supabase
        .from('matter_responses' as any)
        .select(
          `
          id,
          matter_id,
          user_id,
          response,
          created_at,
          updated_at,
          user:user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('matter_id', matterId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as unknown as Array<MatterResponse>
    },
  }
}

export function matterMessagesQuery(matterId: string) {
  return {
    queryKey: ['matters', 'messages', matterId],
    queryFn: async (): Promise<Array<MatterMessage>> => {
      const { data, error } = await supabase
        .from('matter_messages' as any)
        .select(
          `
          id,
          matter_id,
          user_id,
          content,
          created_at,
          updated_at,
          user:user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('matter_id', matterId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as unknown as Array<MatterMessage>
    },
  }
}

export async function createMatter(input: CreateMatterInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Create the matter
  const { data: matter, error: matterError } = await supabase
    .from('matters' as any)
    .insert({
      company_id: input.company_id,
      created_by_user_id: user.id,
      matter_type: input.matter_type,
      title: input.title.trim(),
      content: input.content?.trim() || null,
      job_id: input.job_id || null,
      time_period_id: input.time_period_id || null,
      is_anonymous: input.is_anonymous ?? false,
      allow_custom_responses: input.allow_custom_responses ?? true,
      created_as_company: input.created_as_company ?? false,
    })
    .select('id')
    .single()

  if (matterError) throw matterError
  if (!matter) throw new Error('Failed to create matter')

  // Create recipients
  // For votes, automatically add the creator as a recipient
  const recipientUserIds = [...input.recipient_user_ids]
  if (input.matter_type === 'vote' && !recipientUserIds.includes(user.id)) {
    recipientUserIds.push(user.id)
  }

  if (recipientUserIds.length > 0) {
    const recipients = recipientUserIds.map((userId) => ({
      matter_id: matter.id,
      user_id: userId,
      status: 'pending' as const,
    }))

    const { error: recipientsError } = await supabase
      .from('matter_recipients' as any)
      .insert(recipients)

    if (recipientsError) throw recipientsError
  }

  // Upload files if provided
  if (input.files && input.files.length > 0) {
    for (const file of input.files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const timestamp = Date.now()
      const filename = `${timestamp}.${ext}`
      const path = `${matter.id}/${filename}`

      // Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from('matter_files')
        .upload(path, file, {
          upsert: false,
          cacheControl: '3600',
        })

      if (uploadErr) throw uploadErr

      // Insert file metadata
      const { error: fileErr } = await supabase
        .from('matter_files' as any)
        .insert({
          matter_id: matter.id,
          filename: file.name,
          path,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by_user_id: user.id,
        })

      if (fileErr) throw fileErr
    }
  }

  return matter.id
}

export async function createVote(input: CreateVoteInput): Promise<string> {
  return createMatter({
    ...input,
    matter_type: 'vote',
    is_anonymous: input.is_anonymous ?? false,
    allow_custom_responses: input.allow_custom_responses ?? true,
    files: input.files,
  })
}

export async function sendCrewInvites(
  jobId: string,
  timePeriodId: string,
  companyId: string,
  invitationMessage?: string | null,
): Promise<string> {
  // Get current user who is sending the invite (the creator)
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  if (!currentUser) throw new Error('Not authenticated')

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('id', jobId)
    .single()

  if (jobError) throw jobError

  // Get time period info
  const { data: timePeriod, error: tpError } = await supabase
    .from('time_periods')
    .select('id, title, start_at, end_at')
    .eq('id', timePeriodId)
    .single()

  if (tpError) throw tpError

  // Get crew for this role that haven't been invited yet (status is 'planned')
  const { data: crew, error: crewError } = await supabase
    .from('reserved_crew')
    .select('user_id')
    .eq('time_period_id', timePeriodId)
    .eq('status', 'planned')

  if (crewError) throw crewError

  if (!crew || crew.length === 0) {
    throw new Error('No crew members to invite (add crew members first)')
  }

  // Filter out the creator from the recipient list
  const userIds = crew
    .map((c) => c.user_id)
    .filter((id): id is string => !!id && id !== currentUser.id)

  // Check if there are any recipients after filtering out the creator
  if (userIds.length === 0) {
    throw new Error(
      'No crew members to invite (all crew members are already invited or you are the only crew member)',
    )
  }

  const roleTitle = timePeriod.title || 'Role'
  const startDate = timePeriod.start_at
    ? new Date(timePeriod.start_at).toLocaleDateString()
    : ''
  const endDate = timePeriod.end_at
    ? new Date(timePeriod.end_at).toLocaleDateString()
    : ''

  const title = `Crew invitation: ${roleTitle}`
  const content = `You have been invited to work on "${job.title}" as ${roleTitle}${startDate && endDate ? ` from ${startDate} to ${endDate}` : ''}.`

  // Create the matter
  const matterId = await createMatter({
    company_id: companyId,
    matter_type: 'crew_invite',
    title,
    content,
    job_id: jobId,
    time_period_id: timePeriodId,
    recipient_user_ids: userIds,
  })

  // Store invitation message if provided
  if (invitationMessage) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { error: messageError } = await supabase
        .from('matter_messages' as any)
        .insert({
          matter_id: matterId,
          user_id: user.id,
          content: invitationMessage.trim(),
        })
      if (messageError) throw messageError
    }
  }

  // Keep reserved_crew in planned status after sending invites
  const { error: updateError } = await supabase
    .from('reserved_crew')
    .update({ status: 'planned' as const })
    .eq('time_period_id', timePeriodId)
    .eq('status', 'planned')
    .in('user_id', userIds)

  if (updateError) throw updateError

  return matterId
}

// Helper function to format date in 24-hour format
function formatDateTime24h(dateString: string): string {
  const d = new Date(dateString)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// Helper function to calculate hours between two dates
function calculateHours(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end.getTime() - start.getTime()
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10 // Round to 1 decimal
}

export async function sendCrewInvite(
  jobId: string,
  timePeriodId: string,
  userId: string,
  companyId: string,
  invitationMessage?: string | null,
): Promise<string> {
  // Get job info with address
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(
      'id, title, job_address_id, address:job_address_id ( id, name, address_line, zip_code, city, country )',
    )
    .eq('id', jobId)
    .single()

  if (jobError) throw jobError

  // Get time period info
  const { data: timePeriod, error: tpError } = await supabase
    .from('time_periods')
    .select('id, title, start_at, end_at')
    .eq('id', timePeriodId)
    .single()

  if (tpError) throw tpError

  // Get reserved_crew row to check status and get notes
  const { data: crewRow, error: crewError } = await supabase
    .from('reserved_crew')
    .select('id, user_id, notes, status')
    .eq('time_period_id', timePeriodId)
    .eq('user_id', userId)
    .maybeSingle()

  if (crewError) throw crewError

  if (!crewRow) {
    throw new Error('Crew member not found for this role')
  }

  if (crewRow.status !== 'planned') {
    throw new Error(
      `Crew member is already in ${crewRow.status} status. Only planned crew can be invited.`,
    )
  }

  const roleTitle = timePeriod.title || 'Role'

  // Format role time in 24-hour format and calculate hours
  let roleTimeStr = ''
  let hoursStr = ''
  if (timePeriod.start_at && timePeriod.end_at) {
    const startFormatted = formatDateTime24h(timePeriod.start_at)
    const endFormatted = formatDateTime24h(timePeriod.end_at)
    const hours = calculateHours(timePeriod.start_at, timePeriod.end_at)
    roleTimeStr = `${startFormatted} - ${endFormatted}`
    hoursStr = ` (${hours} hours)`
  }

  // Build address string for map query
  let addressStr = ''
  if (job.address) {
    const addr = job.address as any
    const parts = [
      addr.address_line,
      addr.zip_code,
      addr.city,
      addr.country,
    ].filter(Boolean)
    addressStr = parts.join(', ')
  }

  const title = `Crew invitation: ${roleTitle}`
  let content = `You have been invited to work on "${job.title}" as ${roleTitle}.`

  if (roleTimeStr) {
    content += `\n\nRole Time: ${roleTimeStr}${hoursStr}`
  }

  if (addressStr) {
    content += `\n\nAddress: ${addressStr}`
  }

  if (crewRow.notes) {
    content += `\n\nNotes: ${crewRow.notes}`
  }

  // Create the matter
  const matterId = await createMatter({
    company_id: companyId,
    matter_type: 'crew_invite',
    title,
    content,
    job_id: jobId,
    time_period_id: timePeriodId,
    recipient_user_ids: [userId],
  })

  // Store invitation message if provided
  if (invitationMessage) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { error: messageError } = await supabase
        .from('matter_messages' as any)
        .insert({
          matter_id: matterId,
          user_id: user.id,
          content: invitationMessage.trim(),
        })
      if (messageError) throw messageError
    }
  }

  // Store map query in matter content or metadata (we'll fetch it separately in UI)
  // For now, the address is in the content, and we'll fetch it in MatterDetail

  // Keep reserved_crew in planned status after sending invite
  const { error: updateError } = await supabase
    .from('reserved_crew')
    .update({ status: 'planned' as const })
    .eq('id', crewRow.id)

  if (updateError) throw updateError

  return matterId
}

export async function respondToMatter(
  matterId: string,
  response: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const trimmedResponse = response.trim().toLowerCase()

  // Get matter to check if it's a crew_invite
  const { data: matter, error: matterError } = await supabase
    .from('matters' as any)
    .select('matter_type, job_id, time_period_id')
    .eq('id', matterId)
    .single()

  if (matterError) throw matterError

  // Upsert response
  const { error: responseError } = await supabase
    .from('matter_responses' as any)
    .upsert(
      {
        matter_id: matterId,
        user_id: user.id,
        response: response.trim(),
      },
      {
        onConflict: 'matter_id,user_id',
      },
    )

  if (responseError) throw responseError

  // Determine recipient status based on response
  // For votes: 'approved' -> 'accepted', 'rejected' -> 'declined', otherwise -> 'responded'
  // For crew_invite: 'approved' -> 'confirmed', 'rejected' -> 'canceled'
  let recipientStatus: 'accepted' | 'declined' | 'responded' = 'responded'
  let crewStatus: 'confirmed' | 'canceled' | null = null
  if (trimmedResponse === 'approved') {
    recipientStatus = 'accepted'
    crewStatus = 'confirmed'
  } else if (trimmedResponse === 'rejected') {
    recipientStatus = 'declined'
    crewStatus = 'canceled'
  }

  // Update recipient status
  const { data: updatedRecipients, error: recipientError } = await supabase
    .from('matter_recipients' as any)
    .update({
      status: recipientStatus as any,
      responded_at: new Date().toISOString(),
    })
    .eq('matter_id', matterId)
    .eq('user_id', user.id)
    .select()

  if (recipientError) throw recipientError

  // If no rows were updated, recipient might not exist - try to create it
  // This shouldn't normally happen, but handle gracefully
  if (!updatedRecipients || updatedRecipients.length === 0) {
    const { error: createError } = await supabase
      .from('matter_recipients' as any)
      .insert({
        matter_id: matterId,
        user_id: user.id,
        status: recipientStatus as any,
        responded_at: new Date().toISOString(),
      })

    if (createError) {
      // If creation also fails, throw the error
      throw new Error(
        `Failed to update recipient status: ${createError.message}`,
      )
    }
  }

  // If this is a crew_invite and we have a crew status, update reserved_crew
  if (
    matter.matter_type === 'crew_invite' &&
    crewStatus &&
    matter.time_period_id
  ) {
    const { error: crewUpdateError } = await supabase
      .from('reserved_crew')
      .update({ status: crewStatus as any })
      .eq('time_period_id', matter.time_period_id)
      .eq('user_id', user.id)

    if (crewUpdateError) throw crewUpdateError
  }
}

export async function sendMessage(
  matterId: string,
  content: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('matter_messages' as any).insert({
    matter_id: matterId,
    user_id: user.id,
    content: content.trim(),
  })

  if (error) throw error
}

export async function markMatterAsViewed(matterId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('matter_recipients' as any)
    .update({
      status: 'viewed' as any,
      viewed_at: new Date().toISOString(),
    })
    .eq('matter_id', matterId)
    .eq('user_id', user.id)

  if (error) throw error
}

export function matterFilesQuery(matterId: string) {
  return {
    queryKey: ['matters', 'files', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matter_files' as any)
        .select(
          `
          id,
          matter_id,
          filename,
          path,
          mime_type,
          size_bytes,
          title,
          note,
          uploaded_by_user_id,
          created_at,
          uploaded_by:uploaded_by_user_id ( user_id, display_name, email )
        `,
        )
        .eq('matter_id', matterId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as Array<import('../types').MatterFile>
    },
  }
}

// Count unread matters from all companies the user is a member of
export function unreadMattersCountQueryAll() {
  return {
    queryKey: ['matters', 'unread-count', 'all'],
    queryFn: async (): Promise<number> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return 0

      // Get all companies the user is a member of
      const { data: profile } = await supabase
        .from('profiles')
        .select('superuser')
        .eq('user_id', user.id)
        .maybeSingle()

      const isSuperuser = profile?.superuser ?? false

      let companyIds: Array<string> = []
      if (isSuperuser) {
        // Superusers can access all companies
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('id')
        companyIds = (allCompanies || []).map((c) => c.id)
      } else {
        // Regular users only see companies they're members of
        const { data: memberships } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
        companyIds = (memberships || []).map((m) => m.company_id)
      }

      if (companyIds.length === 0) return 0

      // Get all matters where user is a recipient
      const { data: recipientMatters, error: recError } = await supabase
        .from('matter_recipients' as any)
        .select('matter_id, viewed_at')
        .eq('user_id', user.id)
        .is('viewed_at', null) // Only unread ones

      if (recError) throw recError

      // Get the matter IDs for unread matters
      const unreadMatterIds =
        recipientMatters?.map((r) => r.matter_id as string) || []

      if (unreadMatterIds.length === 0) return 0

      // Filter to only matters in companies the user is a member of.
      // Exclude matters created by the user unless created_as_company is true.
      const { data: companyMatters, error: matterError } = await supabase
        .from('matters' as any)
        .select('id, created_by_user_id, created_as_company')
        .in('company_id', companyIds)
        .in('id', unreadMatterIds)

      if (matterError) throw matterError

      const filtered = (companyMatters || []).filter(
        (matter: {
          created_by_user_id: string
          created_as_company?: boolean
        }) =>
          matter.created_by_user_id !== user.id || matter.created_as_company,
      )

      return filtered.length
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  }
}

// Legacy function - kept for backward compatibility
export function unreadMattersCountQuery(companyId: string) {
  return {
    queryKey: ['matters', 'unread-count', companyId],
    queryFn: async (): Promise<number> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return 0

      // Get all matters where user is a recipient
      const { data: recipientMatters, error: recError } = await supabase
        .from('matter_recipients' as any)
        .select('matter_id, viewed_at')
        .eq('user_id', user.id)
        .is('viewed_at', null) // Only unread ones

      if (recError) throw recError

      // Get the matter IDs for unread matters
      const unreadMatterIds =
        recipientMatters?.map((r) => r.matter_id as string) || []

      if (unreadMatterIds.length === 0) return 0

      // Filter to only matters in the current company.
      // Exclude matters created by the user unless created_as_company is true.
      const { data: companyMatters, error: matterError } = await supabase
        .from('matters' as any)
        .select('id, created_by_user_id, created_as_company')
        .eq('company_id', companyId)
        .in('id', unreadMatterIds)

      if (matterError) throw matterError

      const filtered = (companyMatters || []).filter(
        (matter: {
          created_by_user_id: string
          created_as_company?: boolean
        }) =>
          matter.created_by_user_id !== user.id || matter.created_as_company,
      )

      return filtered.length
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  }
}

export async function deleteMatter(matterId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify user is the creator
  const { data: matter, error: matterError } = await supabase
    .from('matters' as any)
    .select('created_by_user_id')
    .eq('id', matterId)
    .single()

  if (matterError) throw matterError
  if (!matter) throw new Error('Matter not found')
  if (matter.created_by_user_id !== user.id) {
    throw new Error('Only the creator can delete this matter')
  }

  // Get all files associated with this matter before deleting
  const { data: matterFiles, error: filesError } = await supabase
    .from('matter_files' as any)
    .select('path')
    .eq('matter_id', matterId)

  if (filesError) throw filesError

  // Delete files from storage if any exist
  if (matterFiles && matterFiles.length > 0) {
    const paths = matterFiles.map((f) => f.path)
    const { error: storageError } = await supabase.storage
      .from('matter_files')
      .remove(paths)

    if (storageError) throw storageError
  }

  // Delete the matter (cascade will handle related database records)
  const { error: deleteError } = await supabase
    .from('matters' as any)
    .delete()
    .eq('id', matterId)

  if (deleteError) throw deleteError
}
